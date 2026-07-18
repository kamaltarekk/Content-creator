import "server-only";

import type {
  ClientBrainFieldKey,
  ClientBrainSectionKey,
  ImportReviewAction,
  InformationType,
} from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { applyApproval, type ApplyApprovalResult } from "@/server/services/clientBrain.service";
import { recalculateSourceCompletion } from "@/server/services/source.service";

export class ReviewError extends Error {}

export type ResolveReviewInput = {
  reviewId: string;
  action: ImportReviewAction;
  reviewerId: string;
  organizationId: string;
  // Optional overrides for edit / remap / reclassify actions.
  editedValueText?: string;
  editedSectionKey?: ClientBrainSectionKey;
  editedFieldKey?: ClientBrainFieldKey;
  reviewNotes?: string;
};

const RECLASSIFY_ACTIONS: Partial<Record<ImportReviewAction, InformationType>> = {
  MARK_HYPOTHESIS: "HYPOTHESIS",
  MARK_AUDIENCE_SIGNAL: "AUDIENCE_SIGNAL",
  MARK_EVIDENCE: "EVIDENCE",
};

const APPROVING_ACTIONS: ImportReviewAction[] = [
  "APPROVE",
  "APPROVE_WITH_EDIT",
  "REMAP",
  "MARK_HYPOTHESIS",
  "MARK_AUDIENCE_SIGNAL",
  "MARK_EVIDENCE",
];

/**
 * Resolves one import review. Approving writes to the Client Brain via
 * applyApproval (which itself refuses to overwrite conflicting approved data
 * — it opens a Conflict instead). Reject / keep-as-raw never touch the brain.
 * The mark-as-* actions reclassify the item's information type and then
 * approve, per the product's treatment of those as combined actions.
 */
export async function resolveReview(input: ResolveReviewInput): Promise<{
  approval?: ApplyApprovalResult;
}> {
  const review = await prisma.importReview.findUniqueOrThrow({
    where: { id: input.reviewId },
    include: { extractedItem: true },
  });
  if (review.status === "RESOLVED") {
    throw new ReviewError("This item has already been reviewed.");
  }

  const item = review.extractedItem;

  // Reject: resolve without writing to the brain.
  if (input.action === "REJECT") {
    await markResolved(input, review.clientId);
    return {};
  }

  // Keep as raw material: resolve, keep the source block as raw context only.
  if (input.action === "KEEP_AS_RAW") {
    await prisma.extractedItem.update({
      where: { id: item.id },
      data: { informationType: "RAW_NOTE" },
    });
    await markResolved(input, review.clientId);
    return {};
  }

  if (input.action === "RESOLVE_CONFLICT") {
    throw new ReviewError("Conflicts are resolved from the conflict view, not the review action.");
  }

  if (!APPROVING_ACTIONS.includes(input.action)) {
    throw new ReviewError(`Unsupported review action: ${input.action}`);
  }

  // Determine the destination/value to approve, applying any edits/remaps.
  const sectionKey = input.editedSectionKey ?? item.proposedSectionKey;
  const fieldKey = input.editedFieldKey ?? item.proposedFieldKey;
  const valueText = (input.editedValueText ?? item.normalizedValueText ?? "").trim();

  if (!sectionKey || !fieldKey) {
    throw new ReviewError("A section and field are required to approve this item into the Client Brain.");
  }
  if (!valueText) {
    throw new ReviewError("An empty value cannot be approved.");
  }

  // Reclassify information type for the mark-as-* actions.
  const reclassified = RECLASSIFY_ACTIONS[input.action];
  if (reclassified) {
    await prisma.extractedItem.update({
      where: { id: item.id },
      data: { informationType: reclassified },
    });
  }

  const approval = await applyApproval({
    extractedItemId: item.id,
    reviewerId: input.reviewerId,
    organizationId: input.organizationId,
    sectionKey,
    fieldKey,
    valueText,
    informationType: reclassified ?? item.informationType,
    confidence: item.confidence,
  });

  if (approval.status === "conflict") {
    // Don't mark the review resolved — a Conflict now needs explicit resolution.
    await prisma.importReview.update({
      where: { id: review.id },
      data: { reviewNotes: input.reviewNotes ?? "Approval opened a conflict — resolve it to proceed." },
    });
    return { approval };
  }

  await prisma.importReview.update({
    where: { id: review.id },
    data: {
      status: "RESOLVED",
      resolutionAction: input.action,
      editedValueText: input.editedValueText ?? null,
      editedSectionKey: input.editedSectionKey ?? null,
      editedFieldKey: input.editedFieldKey ?? null,
      reviewerId: input.reviewerId,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes ?? null,
    },
  });

  await recalculateSourceCompletion(item.sourceId);

  return { approval };
}

async function markResolved(input: ResolveReviewInput, clientId: string) {
  const updated = await prisma.importReview.update({
    where: { id: input.reviewId },
    data: {
      status: "RESOLVED",
      resolutionAction: input.action,
      reviewerId: input.reviewerId,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes ?? null,
    },
    include: { extractedItem: true },
  });

  await logAudit({
    organizationId: input.organizationId,
    clientId,
    actorUserId: input.reviewerId,
    action: input.action === "REJECT" ? "REJECT" : "UPDATE",
    entityType: "ImportReview",
    entityId: input.reviewId,
    metadata: { action: input.action },
  });

  await recalculateSourceCompletion(updated.extractedItem.sourceId);
}

/**
 * Bulk-approves only clearly-safe items: VALID, high enough confidence, not a
 * conflict candidate, not a duplicate, and with a concrete destination. Never
 * auto-approves conflicts (spec section F). Returns per-item outcomes.
 */
export async function bulkApproveSafe(input: {
  reviewIds: string[];
  reviewerId: string;
  organizationId: string;
}): Promise<{ approvedCount: number; skippedCount: number; conflictCount: number }> {
  const reviews = await prisma.importReview.findMany({
    where: { id: { in: input.reviewIds }, status: "PENDING" },
    include: { extractedItem: true },
  });

  let approvedCount = 0;
  let skippedCount = 0;
  let conflictCount = 0;

  for (const review of reviews) {
    const item = review.extractedItem;
    const safe =
      item.validationStatus === "VALID" &&
      !item.isConflictCandidate &&
      !item.duplicateOfItemId &&
      item.confidence >= 0.55 &&
      Boolean(item.proposedSectionKey) &&
      Boolean(item.proposedFieldKey) &&
      Boolean(item.normalizedValueText);

    if (!safe) {
      skippedCount += 1;
      continue;
    }

    const result = await resolveReview({
      reviewId: review.id,
      action: "APPROVE",
      reviewerId: input.reviewerId,
      organizationId: input.organizationId,
    });

    if (result.approval?.status === "conflict") {
      conflictCount += 1;
    } else {
      approvedCount += 1;
    }
  }

  return { approvedCount, skippedCount, conflictCount };
}

// ---- Queries for the review queue ----

export type ReviewFilter =
  | "ALL"
  | "HIGH_CONFIDENCE"
  | "LOW_CONFIDENCE"
  | "CONFLICTS"
  | "STRATEGIC_FACTS"
  | "AUDIENCE_SIGNALS"
  | "EVIDENCE"
  | "HYPOTHESES"
  | "RAW_NOTES"
  | "EXTERNAL_SOURCES";

export async function listPendingReviews(clientId: string) {
  const reviews = await prisma.importReview.findMany({
    where: { clientId, status: "PENDING" },
    include: {
      extractedItem: {
        include: { sourceBlock: true, source: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return reviews;
}

export async function getPendingReviewCount(clientId: string) {
  return prisma.importReview.count({ where: { clientId, status: "PENDING" } });
}

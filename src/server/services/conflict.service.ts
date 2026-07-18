import "server-only";

import type {
  ChangeType,
  ClientBrainFieldKey,
  ClientBrainItem,
  ConflictResolutionType,
} from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { fieldValueType } from "@/server/domain/brain-schema";
import { diceCoefficient } from "@/server/domain/similarity";
import { logAudit } from "@/server/services/audit.service";

/** Similarity at or above this means "the same entity instance" when grouping repeatable items. */
export const ENTITY_MATCH_THRESHOLD = 0.75;
/** Free-text similarity at or above this is treated as effectively unchanged (no conflict). */
export const TEXT_UNCHANGED_THRESHOLD = 0.82;
/** Below this, a free-text change is a strong (materially different) conflict. */
export const TEXT_STRONG_CONFLICT_THRESHOLD = 0.5;

export type ComparisonResult = {
  changeType: ChangeType;
  isConflict: boolean;
  similarity: number | null;
  reason: string;
};

function parseNumber(value: string): number | null {
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function toSet(value: string): Set<string> {
  return new Set(
    value
      .split(/[,\n;]/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Decides whether a proposed value materially differs from the existing one,
 * comparing per the field's value type (spec section 15):
 *  - percentage/ratio fields tolerate max(2 points, 15%) drift
 *  - numeric price tolerates 10% relative difference
 *  - list fields tolerate pure additions (suggest MERGE); flag >30% removals
 *  - free text uses Dice similarity thresholds
 */
export function compareValues(
  field: ClientBrainFieldKey,
  existingValue: string,
  proposedValue: string,
): ComparisonResult {
  if (existingValue.trim() === proposedValue.trim()) {
    return { changeType: "UNCHANGED", isConflict: false, similarity: 1, reason: "Identical value." };
  }

  const valueType = fieldValueType(field);

  if (valueType === "percentage") {
    const oldNum = parseNumber(existingValue);
    const newNum = parseNumber(proposedValue);
    if (oldNum !== null && newNum !== null) {
      const tolerance = Math.max(2, Math.abs(oldNum) * 0.15);
      const conflict = Math.abs(newNum - oldNum) > tolerance;
      return {
        changeType: conflict ? "CONFLICTING" : "UPDATED",
        isConflict: conflict,
        similarity: null,
        reason: conflict
          ? `Percentage changed from ${oldNum} to ${newNum} (beyond ${tolerance.toFixed(1)} tolerance).`
          : "Percentage changed within tolerance.",
      };
    }
  }

  if (valueType === "numeric") {
    const oldNum = parseNumber(existingValue);
    const newNum = parseNumber(proposedValue);
    if (oldNum !== null && newNum !== null && oldNum !== 0) {
      const relative = Math.abs(newNum - oldNum) / Math.abs(oldNum);
      const conflict = relative > 0.1;
      return {
        changeType: conflict ? "CONFLICTING" : "UPDATED",
        isConflict: conflict,
        similarity: null,
        reason: conflict
          ? `Value changed from ${oldNum} to ${newNum} (${(relative * 100).toFixed(0)}% difference).`
          : "Value changed within 10% tolerance.",
      };
    }
  }

  if (valueType === "list") {
    const oldSet = toSet(existingValue);
    const newSet = toSet(proposedValue);
    const removed = [...oldSet].filter((item) => !newSet.has(item));
    const added = [...newSet].filter((item) => !oldSet.has(item));
    const removalRatio = oldSet.size > 0 ? removed.length / oldSet.size : 0;
    if (removed.length === 0) {
      return {
        changeType: "UPDATED",
        isConflict: false,
        similarity: null,
        reason: added.length ? `Adds ${added.length} item(s); no removals (merge safe).` : "No changes.",
      };
    }
    const conflict = removalRatio > 0.3;
    return {
      changeType: conflict ? "CONFLICTING" : "UPDATED",
      isConflict: conflict,
      similarity: null,
      reason: `Removes ${removed.length} of ${oldSet.size} listed item(s).`,
    };
  }

  // Free text
  const similarity = diceCoefficient(existingValue, proposedValue);
  if (similarity >= TEXT_UNCHANGED_THRESHOLD) {
    return { changeType: "UNCHANGED", isConflict: false, similarity, reason: "Effectively the same wording." };
  }
  if (similarity >= TEXT_STRONG_CONFLICT_THRESHOLD) {
    return {
      changeType: "UPDATED",
      isConflict: true,
      similarity,
      reason: `Reworded but materially different (similarity ${similarity.toFixed(2)}).`,
    };
  }
  return {
    changeType: "CONFLICTING",
    isConflict: true,
    similarity,
    reason: `Substantially different value (similarity ${similarity.toFixed(2)}).`,
  };
}

/**
 * Finds the existing ACTIVE Client Brain item a proposed value would land on:
 * same client + section + field, and — for entity sections — the same group
 * (matched by fuzzy name similarity ≥ ENTITY_MATCH_THRESHOLD via groupId).
 */
export async function findExistingBrainItem(params: {
  clientId: string;
  fieldKey: ClientBrainFieldKey;
  sectionKey: ClientBrainItem["sectionKey"];
  groupId?: string | null;
}): Promise<ClientBrainItem | null> {
  return prisma.clientBrainItem.findFirst({
    where: {
      clientId: params.clientId,
      sectionKey: params.sectionKey,
      fieldKey: params.fieldKey,
      status: "ACTIVE",
      ...(params.groupId ? { groupId: params.groupId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function listConflictsForClient(clientId: string) {
  return prisma.conflict.findMany({
    where: { clientId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      clientBrainItem: true,
      extractedItem: { include: { sourceBlock: true, source: true } },
    },
  });
}

export function getConflictById(conflictId: string) {
  return prisma.conflict.findUnique({
    where: { id: conflictId },
    include: {
      clientBrainItem: { include: { sourceLinks: true } },
      extractedItem: { include: { sourceBlock: true, source: true } },
      resolutions: true,
    },
  });
}

export type ResolveConflictInput = {
  conflictId: string;
  resolutionType: ConflictResolutionType;
  reviewerId: string;
  organizationId: string;
  /** For REPLACE/MERGE: the value to store; falls back to the proposed value. */
  resolvedValueText?: string;
  note?: string;
};

/**
 * Resolves a conflict without ever silently overwriting approved strategy —
 * the reviewer explicitly chooses the outcome:
 *  - KEEP_EXISTING: discard the proposed value, restore the item to ACTIVE
 *  - REPLACE: adopt the proposed value as a new version (with source trace)
 *  - MERGE: store a reviewer-provided merged value as a new version
 *  - STORE_BOTH: keep the existing value and add the proposed one as a new,
 *    context-specific item
 *  - MARK_UNRESOLVED: record the decision but leave the conflict open
 */
export async function resolveConflict(input: ResolveConflictInput) {
  const conflict = await prisma.conflict.findUniqueOrThrow({
    where: { id: input.conflictId },
    include: { clientBrainItem: true, extractedItem: { include: { sourceBlock: true } } },
  });
  if (conflict.status !== "OPEN") {
    throw new Error("This conflict has already been resolved.");
  }

  const existing = conflict.clientBrainItem;
  const extracted = conflict.extractedItem;
  const proposedValue = input.resolvedValueText?.trim() || extracted.normalizedValueText || "";

  await prisma.$transaction(async (tx) => {
    await tx.conflictResolution.create({
      data: {
        conflictId: conflict.id,
        resolutionType: input.resolutionType,
        resolvedValueText: proposedValue || null,
        resolvedById: input.reviewerId,
        note: input.note ?? null,
      },
    });

    if (input.resolutionType === "MARK_UNRESOLVED") {
      // Leave the conflict OPEN and the item DISPUTED — a deliberate defer.
      return;
    }

    if (input.resolutionType === "KEEP_EXISTING") {
      await tx.clientBrainItem.update({ where: { id: existing.id }, data: { status: "ACTIVE" } });
    }

    if (input.resolutionType === "REPLACE" || input.resolutionType === "MERGE") {
      const nextVersion = existing.currentVersionNumber + 1;
      await tx.clientBrainItem.update({
        where: { id: existing.id },
        data: { valueText: proposedValue, status: "ACTIVE", currentVersionNumber: nextVersion },
      });
      await tx.clientBrainItemVersion.create({
        data: {
          clientBrainItemId: existing.id,
          versionNumber: nextVersion,
          valueText: proposedValue,
          status: "ACTIVE",
          confidence: extracted.confidence,
          changeType: "UPDATED",
          changedById: input.reviewerId,
          changeNote:
            input.resolutionType === "MERGE" ? "Merged during conflict resolution" : "Replaced during conflict resolution",
        },
      });
      await tx.clientBrainItemSource.create({
        data: {
          clientBrainItemId: existing.id,
          sourceId: extracted.sourceId,
          sourceBlockId: extracted.sourceBlockId,
          extractedItemId: extracted.id,
          approvedById: input.reviewerId,
        },
      });
    }

    if (input.resolutionType === "STORE_BOTH") {
      await tx.clientBrainItem.update({ where: { id: existing.id }, data: { status: "ACTIVE" } });
      const created = await tx.clientBrainItem.create({
        data: {
          clientId: conflict.clientId,
          sectionKey: existing.sectionKey,
          fieldKey: existing.fieldKey,
          subjectLabel: "Context-specific (stored alongside existing)",
          valueText: proposedValue,
          status: "ACTIVE",
          confidence: extracted.confidence,
          currentVersionNumber: 1,
          createdById: input.reviewerId,
        },
      });
      await tx.clientBrainItemVersion.create({
        data: {
          clientBrainItemId: created.id,
          versionNumber: 1,
          valueText: proposedValue,
          status: "ACTIVE",
          confidence: extracted.confidence,
          changeType: "ADDED",
          changedById: input.reviewerId,
          changeNote: "Stored as a context-specific alternative during conflict resolution",
        },
      });
      await tx.clientBrainItemSource.create({
        data: {
          clientBrainItemId: created.id,
          sourceId: extracted.sourceId,
          sourceBlockId: extracted.sourceBlockId,
          extractedItemId: extracted.id,
          approvedById: input.reviewerId,
        },
      });
    }

    // Mark the conflict resolved and close out the originating review.
    await tx.conflict.update({
      where: { id: conflict.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    await tx.importReview.updateMany({
      where: { extractedItemId: extracted.id, status: "PENDING" },
      data: {
        status: "RESOLVED",
        resolutionAction: "RESOLVE_CONFLICT",
        reviewerId: input.reviewerId,
        reviewedAt: new Date(),
      },
    });
  });

  await logAudit({
    organizationId: input.organizationId,
    clientId: conflict.clientId,
    actorUserId: input.reviewerId,
    action: "CONFLICT_RESOLVE",
    entityType: "Conflict",
    entityId: conflict.id,
    metadata: { resolutionType: input.resolutionType },
  });
}

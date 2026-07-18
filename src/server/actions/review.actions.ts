"use server";

import { revalidatePath } from "next/cache";
import type { ClientBrainFieldKey, ClientBrainSectionKey, ImportReviewAction } from "@prisma/client";

import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { resolveReview, bulkApproveSafe, ReviewError } from "@/server/services/import.service";

async function clientIdForReview(reviewId: string): Promise<string> {
  const review = await prisma.importReview.findUniqueOrThrow({
    where: { id: reviewId },
    select: { clientId: true },
  });
  return review.clientId;
}

export type ResolveReviewActionInput = {
  reviewId: string;
  action: ImportReviewAction;
  editedValueText?: string;
  editedSectionKey?: ClientBrainSectionKey;
  editedFieldKey?: ClientBrainFieldKey;
  reviewNotes?: string;
};

export async function resolveReviewAction(input: ResolveReviewActionInput) {
  const clientId = await clientIdForReview(input.reviewId);
  // Approving conflict-prone or approving-into-active actions require the
  // conflict permission; plain approves/rejects need review.approve.
  const session = await requireAction("review.approve", { clientId });
  if (!session.user.orgId) throw new Error("No organization on account.");

  try {
    const result = await resolveReview({
      reviewId: input.reviewId,
      action: input.action,
      reviewerId: session.user.id,
      organizationId: session.user.orgId,
      editedValueText: input.editedValueText,
      editedSectionKey: input.editedSectionKey,
      editedFieldKey: input.editedFieldKey,
      reviewNotes: input.reviewNotes,
    });

    revalidatePath(`/c/${clientId}/reviews`);
    revalidatePath(`/c/${clientId}/brain`);

    return {
      openedConflict: result.approval?.status === "conflict",
      conflictId: result.approval?.status === "conflict" ? result.approval.conflict.id : null,
    };
  } catch (error) {
    if (error instanceof ReviewError) throw new Error(error.message);
    throw error;
  }
}

export async function bulkApproveSafeAction(clientId: string, reviewIds: string[]) {
  const session = await requireAction("review.approve", { clientId });
  if (!session.user.orgId) throw new Error("No organization on account.");

  const result = await bulkApproveSafe({
    reviewIds,
    reviewerId: session.user.id,
    organizationId: session.user.orgId,
  });

  revalidatePath(`/c/${clientId}/reviews`);
  revalidatePath(`/c/${clientId}/brain`);
  return result;
}

"use server";

import { revalidatePath } from "next/cache";
import type { ConflictResolutionType } from "@prisma/client";

import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { resolveConflict } from "@/server/services/conflict.service";

export async function resolveConflictAction(input: {
  conflictId: string;
  resolutionType: ConflictResolutionType;
  resolvedValueText?: string;
  note?: string;
}) {
  const conflict = await prisma.conflict.findUniqueOrThrow({
    where: { id: input.conflictId },
    select: { clientId: true },
  });

  const session = await requireAction("conflict.resolve", { clientId: conflict.clientId });
  if (!session.user.orgId) throw new Error("No organization on account.");

  await resolveConflict({
    conflictId: input.conflictId,
    resolutionType: input.resolutionType,
    reviewerId: session.user.id,
    organizationId: session.user.orgId,
    resolvedValueText: input.resolvedValueText,
    note: input.note,
  });

  revalidatePath(`/c/${conflict.clientId}/brain`);
  revalidatePath(`/c/${conflict.clientId}/brain/conflicts`);
  revalidatePath(`/c/${conflict.clientId}/reviews`);
}

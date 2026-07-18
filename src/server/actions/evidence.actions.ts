"use server";

import { revalidatePath } from "next/cache";
import type { StrategicEntityType } from "@prisma/client";

import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import * as evidenceLinkService from "@/server/services/evidenceLink.service";
import { evidenceLinkFieldsSchema, type EvidenceLinkFieldsInput } from "@/server/domain/strategy-form-schema";

export async function addEvidenceLinkAction(
  clientId: string,
  target: { targetEntityType: StrategicEntityType; targetEntityId: string; beliefMapId?: string },
  input: EvidenceLinkFieldsInput,
) {
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = evidenceLinkFieldsSchema.parse(input);
  await evidenceLinkService.addEvidenceLink({
    clientId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    targetEntityType: target.targetEntityType,
    targetEntityId: target.targetEntityId,
    beliefMapId: target.beliefMapId,
    input: parsed,
  });

  if (target.beliefMapId) revalidatePath(`/c/${clientId}/strategy/beliefs/${target.beliefMapId}`);
  revalidatePath(`/c/${clientId}/strategy/beliefs`);
}

export async function removeEvidenceLinkAction(evidenceLinkId: string, clientId: string, beliefMapId?: string) {
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await evidenceLinkService.removeEvidenceLink({
    evidenceLinkId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
  });

  if (beliefMapId) revalidatePath(`/c/${clientId}/strategy/beliefs/${beliefMapId}`);
}

/** Client Brain PROOF/EVIDENCE/LEARNINGS items available to trace evidence to. */
export async function listLinkableEvidenceItemsAction(clientId: string) {
  await requireAction("strategy.view", { clientId });
  return prisma.clientBrainItem.findMany({
    where: { clientId, status: { not: "ARCHIVED" }, sectionKey: { in: ["PROOF", "LEARNINGS"] } },
    select: { id: true, sectionKey: true, fieldKey: true, valueText: true, subjectLabel: true },
    orderBy: { sectionKey: "asc" },
    take: 200,
  });
}

"use server";

import { revalidatePath } from "next/cache";

import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import * as situationService from "@/server/services/commercialSituation.service";
import { commercialSituationFieldsSchema, type CommercialSituationFieldsInput } from "@/server/domain/strategy-form-schema";

async function clientIdForSituation(situationId: string) {
  const situation = await prisma.commercialSituation.findUniqueOrThrow({
    where: { id: situationId },
    select: { clientId: true },
  });
  return situation.clientId;
}

export async function createCommercialSituationAction(
  clientId: string,
  cohortId: string,
  input: CommercialSituationFieldsInput,
) {
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = commercialSituationFieldsSchema.parse(input);
  await situationService.createCommercialSituation({
    clientId,
    cohortId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    input: parsed,
  });

  revalidatePath(`/c/${clientId}/strategy/cohorts/${cohortId}`);
  revalidatePath(`/c/${clientId}/strategy`);
}

export async function updateCommercialSituationAction(situationId: string, input: CommercialSituationFieldsInput) {
  const clientId = await clientIdForSituation(situationId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = commercialSituationFieldsSchema.parse(input);
  await situationService.updateCommercialSituation({
    situationId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    input: parsed,
  });

  revalidatePath(`/c/${clientId}/strategy`);
}

export async function setCommercialSituationApprovalStatusAction(
  situationId: string,
  approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW",
) {
  const clientId = await clientIdForSituation(situationId);
  const action = approvalStatus === "APPROVED" || approvalStatus === "DISPUTED" ? "strategy.approve" : "strategy.edit";
  const session = await requireAction(action, { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await situationService.setCommercialSituationApprovalStatus({
    situationId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    approvalStatus,
  });

  revalidatePath(`/c/${clientId}/strategy`);
}

export async function archiveCommercialSituationAction(situationId: string) {
  const clientId = await clientIdForSituation(situationId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await situationService.archiveCommercialSituation({
    situationId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
  });

  revalidatePath(`/c/${clientId}/strategy`);
}

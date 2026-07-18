"use server";

import { revalidatePath } from "next/cache";

import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import * as beliefService from "@/server/services/belief.service";
import { beliefMapFieldsSchema, type BeliefMapFieldsInput } from "@/server/domain/strategy-form-schema";

async function clientIdForBelief(beliefMapId: string) {
  const belief = await prisma.beliefMap.findUniqueOrThrow({ where: { id: beliefMapId }, select: { clientId: true } });
  return belief.clientId;
}

export async function createBeliefMapAction(clientId: string, cohortId: string, input: BeliefMapFieldsInput) {
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = beliefMapFieldsSchema.parse(input);
  const belief = await beliefService.createBeliefMap({
    clientId,
    cohortId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    input: parsed,
  });

  revalidatePath(`/c/${clientId}/strategy/cohorts/${cohortId}`);
  revalidatePath(`/c/${clientId}/strategy/beliefs`);
  return { beliefMapId: belief.id };
}

export async function updateBeliefMapAction(beliefMapId: string, input: BeliefMapFieldsInput) {
  const clientId = await clientIdForBelief(beliefMapId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = beliefMapFieldsSchema.parse(input);
  await beliefService.updateBeliefMap({
    beliefMapId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    input: parsed,
  });

  revalidatePath(`/c/${clientId}/strategy/beliefs`);
  revalidatePath(`/c/${clientId}/strategy/beliefs/${beliefMapId}`);
}

export async function setBeliefMapApprovalStatusAction(
  beliefMapId: string,
  approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW",
) {
  const clientId = await clientIdForBelief(beliefMapId);
  const action = approvalStatus === "APPROVED" || approvalStatus === "DISPUTED" ? "strategy.approve" : "strategy.edit";
  const session = await requireAction(action, { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await beliefService.setBeliefMapApprovalStatus({
    beliefMapId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    approvalStatus,
  });

  revalidatePath(`/c/${clientId}/strategy/beliefs`);
  revalidatePath(`/c/${clientId}/strategy/beliefs/${beliefMapId}`);
}

export async function archiveBeliefMapAction(beliefMapId: string) {
  const clientId = await clientIdForBelief(beliefMapId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await beliefService.archiveBeliefMap({ beliefMapId, organizationId: session.user.orgId, actorUserId: session.user.id });
  revalidatePath(`/c/${clientId}/strategy/beliefs`);
}

/** Commercial situations on this cohort, for the belief's optional situation link. */
export async function listCohortSituationsForBeliefAction(cohortId: string) {
  const cohort = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { clientId: true } });
  await requireAction("strategy.view", { clientId: cohort.clientId });
  return prisma.commercialSituation.findMany({
    where: { cohortId, status: { not: "ARCHIVED" } },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
}

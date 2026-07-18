"use server";

import { revalidatePath } from "next/cache";

import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import * as decisionService from "@/server/services/buyingDecision.service";
import * as committeeService from "@/server/services/buyingCommittee.service";
import {
  buyingDecisionFieldsSchema,
  buyingRoleParticipantFieldsSchema,
  objectionFieldsSchema,
  decisionCriterionFieldsSchema,
  type BuyingDecisionFieldsInput,
  type BuyingRoleParticipantFieldsInput,
  type ObjectionFieldsInput,
  type DecisionCriterionFieldsInput,
} from "@/server/domain/strategy-form-schema";

async function clientIdForDecision(decisionId: string) {
  const decision = await prisma.buyingDecision.findUniqueOrThrow({ where: { id: decisionId }, select: { clientId: true } });
  return decision.clientId;
}

export async function createBuyingDecisionAction(clientId: string, cohortId: string, input: BuyingDecisionFieldsInput) {
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = buyingDecisionFieldsSchema.parse(input);
  const decision = await decisionService.createBuyingDecision({
    clientId,
    cohortId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    input: parsed,
  });

  revalidatePath(`/c/${clientId}/strategy/cohorts/${cohortId}`);
  revalidatePath(`/c/${clientId}/strategy/decisions`);
  return { decisionId: decision.id };
}

export async function updateBuyingDecisionAction(decisionId: string, input: BuyingDecisionFieldsInput) {
  const clientId = await clientIdForDecision(decisionId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = buyingDecisionFieldsSchema.parse(input);
  await decisionService.updateBuyingDecision({
    decisionId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    input: parsed,
  });

  revalidatePath(`/c/${clientId}/strategy/decisions`);
  revalidatePath(`/c/${clientId}/strategy/decisions/${decisionId}`);
}

export async function setBuyingDecisionApprovalStatusAction(
  decisionId: string,
  approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW",
) {
  const clientId = await clientIdForDecision(decisionId);
  const action = approvalStatus === "APPROVED" || approvalStatus === "DISPUTED" ? "strategy.approve" : "strategy.edit";
  const session = await requireAction(action, { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await decisionService.setBuyingDecisionApprovalStatus({
    decisionId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    approvalStatus,
  });

  revalidatePath(`/c/${clientId}/strategy/decisions`);
  revalidatePath(`/c/${clientId}/strategy/decisions/${decisionId}`);
}

export async function archiveBuyingDecisionAction(decisionId: string) {
  const clientId = await clientIdForDecision(decisionId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await decisionService.archiveBuyingDecision({ decisionId, organizationId: session.user.orgId, actorUserId: session.user.id });
  revalidatePath(`/c/${clientId}/strategy/decisions`);
}

// ---- Buying committee ----

export async function addBuyingRoleParticipantAction(decisionId: string, input: BuyingRoleParticipantFieldsInput) {
  const clientId = await clientIdForDecision(decisionId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = buyingRoleParticipantFieldsSchema.parse(input);
  await committeeService.addBuyingRoleParticipant({
    buyingDecisionId: decisionId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    input: parsed,
  });

  revalidatePath(`/c/${clientId}/strategy/decisions/${decisionId}`);
}

export async function removeBuyingRoleParticipantAction(participantId: string, decisionId: string) {
  const clientId = await clientIdForDecision(decisionId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await committeeService.removeBuyingRoleParticipant({
    participantId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
  });

  revalidatePath(`/c/${clientId}/strategy/decisions/${decisionId}`);
}

export async function addObjectionAction(decisionId: string, input: ObjectionFieldsInput) {
  const clientId = await clientIdForDecision(decisionId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = objectionFieldsSchema.parse(input);
  await committeeService.addObjection({
    buyingDecisionId: decisionId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    input: parsed,
  });

  revalidatePath(`/c/${clientId}/strategy/decisions/${decisionId}`);
}

export async function resolveObjectionAction(objectionId: string, decisionId: string, resolutionNote: string) {
  const clientId = await clientIdForDecision(decisionId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await committeeService.resolveObjection({
    objectionId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    resolutionNote,
  });

  revalidatePath(`/c/${clientId}/strategy/decisions/${decisionId}`);
}

export async function removeObjectionAction(objectionId: string, decisionId: string) {
  const clientId = await clientIdForDecision(decisionId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await committeeService.removeObjection({ objectionId, organizationId: session.user.orgId, actorUserId: session.user.id });
  revalidatePath(`/c/${clientId}/strategy/decisions/${decisionId}`);
}

export async function addDecisionCriterionAction(decisionId: string, input: DecisionCriterionFieldsInput) {
  const clientId = await clientIdForDecision(decisionId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = decisionCriterionFieldsSchema.parse(input);
  await committeeService.addDecisionCriterion({
    buyingDecisionId: decisionId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    input: parsed,
  });

  revalidatePath(`/c/${clientId}/strategy/decisions/${decisionId}`);
}

export async function removeDecisionCriterionAction(criterionId: string, decisionId: string) {
  const clientId = await clientIdForDecision(decisionId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await committeeService.removeDecisionCriterion({ criterionId, organizationId: session.user.orgId, actorUserId: session.user.id });
  revalidatePath(`/c/${clientId}/strategy/decisions/${decisionId}`);
}

/** Commercial situations available on this cohort, for the "link to situation" select when creating a decision. */
export async function listCohortSituationsAction(cohortId: string) {
  const cohort = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { clientId: true } });
  await requireAction("strategy.view", { clientId: cohort.clientId });
  return prisma.commercialSituation.findMany({
    where: { cohortId, status: { not: "ARCHIVED" } },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
}

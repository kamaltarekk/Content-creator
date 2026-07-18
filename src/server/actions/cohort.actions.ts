"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import * as cohortService from "@/server/services/cohort.service";
import { cohortFieldsSchema, type CohortFieldsInput } from "@/server/domain/strategy-form-schema";

async function clientIdForCohort(cohortId: string) {
  const cohort = await prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { clientId: true } });
  return cohort.clientId;
}

export async function createCohortAction(clientId: string, input: CohortFieldsInput) {
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = cohortFieldsSchema.parse(input);
  const cohort = await cohortService.createCohort({
    clientId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    input: parsed,
  });

  revalidatePath(`/c/${clientId}/strategy/cohorts`);
  return { cohortId: cohort.id };
}

export async function updateCohortAction(cohortId: string, input: CohortFieldsInput) {
  const clientId = await clientIdForCohort(cohortId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const parsed = cohortFieldsSchema.parse(input);
  await cohortService.updateCohort({
    cohortId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    input: parsed,
  });

  revalidatePath(`/c/${clientId}/strategy/cohorts`);
  revalidatePath(`/c/${clientId}/strategy/cohorts/${cohortId}`);
}

export async function setCohortApprovalStatusAction(
  cohortId: string,
  approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW",
) {
  const clientId = await clientIdForCohort(cohortId);
  const action = approvalStatus === "APPROVED" || approvalStatus === "DISPUTED" ? "strategy.approve" : "strategy.edit";
  const session = await requireAction(action, { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await cohortService.setCohortApprovalStatus({
    cohortId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    approvalStatus,
  });

  revalidatePath(`/c/${clientId}/strategy/cohorts`);
  revalidatePath(`/c/${clientId}/strategy/cohorts/${cohortId}`);
}

export async function archiveCohortAction(cohortId: string) {
  const clientId = await clientIdForCohort(cohortId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await cohortService.archiveCohort({ cohortId, organizationId: session.user.orgId, actorUserId: session.user.id });

  revalidatePath(`/c/${clientId}/strategy/cohorts`);
}

export async function mergeCohortsAction(primaryCohortId: string, duplicateCohortId: string) {
  const clientId = await clientIdForCohort(primaryCohortId);
  const session = await requireAction("strategy.approve", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  try {
    await cohortService.mergeCohorts({
      primaryCohortId,
      duplicateCohortId,
      organizationId: session.user.orgId,
      actorUserId: session.user.id,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) throw new Error("Merge failed — check both cohorts exist.");
    throw error;
  }

  revalidatePath(`/c/${clientId}/strategy/cohorts`);
  revalidatePath(`/c/${clientId}/strategy/cohorts/${primaryCohortId}`);
}

export async function addCohortSourceReferenceAction(
  cohortId: string,
  input: {
    relationshipType: Parameters<typeof cohortService.addCohortSourceReference>[0]["relationshipType"];
    clientBrainItemId?: string;
    note?: string;
    audienceSignalNote?: string;
  },
) {
  const clientId = await clientIdForCohort(cohortId);
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await cohortService.addCohortSourceReference({
    cohortId,
    organizationId: session.user.orgId,
    linkedById: session.user.id,
    relationshipType: input.relationshipType,
    clientBrainItemId: input.clientBrainItemId,
    note: input.note,
    audienceSignalNote: input.audienceSignalNote,
  });

  revalidatePath(`/c/${clientId}/strategy/cohorts/${cohortId}`);
}

/** Client Brain COHORTS/BELIEFS/PROOF items available to link as cohort sources (never duplicated — referenced only). */
export async function listLinkableBrainItemsAction(clientId: string) {
  await requireAction("strategy.view", { clientId });
  const items = await prisma.clientBrainItem.findMany({
    where: { clientId, status: { not: "ARCHIVED" }, sectionKey: { in: ["COHORTS", "BELIEFS", "PROOF", "MARKETS"] } },
    select: { id: true, sectionKey: true, fieldKey: true, valueText: true, subjectLabel: true },
    orderBy: { sectionKey: "asc" },
    take: 200,
  });
  return items;
}

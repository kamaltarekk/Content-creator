import "server-only";

import type { TriggerType } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { upsertStrategicEntity, removeStrategicEntity } from "@/server/services/strategicEntity.service";

export type CommercialSituationFields = {
  title: string;
  triggerType: TriggerType;
  triggerDescription?: string | null;
  activeProblem?: string | null;
  currentWorkflow?: string | null;
  urgencyNote?: string | null;
};

function orNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

function normalize(input: CommercialSituationFields) {
  return {
    title: input.title,
    triggerType: input.triggerType,
    triggerDescription: orNull(input.triggerDescription),
    activeProblem: orNull(input.activeProblem),
    currentWorkflow: orNull(input.currentWorkflow),
    urgencyNote: orNull(input.urgencyNote),
  };
}

export async function createCommercialSituation(params: {
  clientId: string;
  cohortId: string;
  organizationId: string;
  actorUserId: string;
  input: CommercialSituationFields;
}) {
  const fields = normalize(params.input);

  const situation = await prisma.$transaction(async (tx) => {
    const created = await tx.commercialSituation.create({
      data: {
        clientId: params.clientId,
        cohortId: params.cohortId,
        ...fields,
        status: "DRAFT",
        approvalStatus: "DRAFT",
        currentVersionNumber: 1,
        createdById: params.actorUserId,
      },
    });
    await tx.commercialSituationVersion.create({
      data: {
        commercialSituationId: created.id,
        ...fields,
        status: created.status,
        approvalStatus: created.approvalStatus,
        confidence: created.confidence,
        versionNumber: 1,
        changeType: "ADDED",
        changedById: params.actorUserId,
      },
    });
    return created;
  });

  await upsertStrategicEntity({
    clientId: params.clientId,
    entityType: "COMMERCIAL_SITUATION",
    entityId: situation.id,
    title: situation.title,
    status: situation.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.actorUserId,
    action: "CREATE",
    entityType: "CommercialSituation",
    entityId: situation.id,
    metadata: { cohortId: params.cohortId, title: situation.title },
  });

  return situation;
}

export async function updateCommercialSituation(params: {
  situationId: string;
  organizationId: string;
  actorUserId: string;
  input: CommercialSituationFields;
  changeNote?: string;
}) {
  const existing = await prisma.commercialSituation.findUniqueOrThrow({ where: { id: params.situationId } });
  const fields = normalize(params.input);
  const nextVersion = existing.currentVersionNumber + 1;

  const situation = await prisma.$transaction(async (tx) => {
    const updated = await tx.commercialSituation.update({
      where: { id: params.situationId },
      data: { ...fields, currentVersionNumber: nextVersion },
    });
    await tx.commercialSituationVersion.create({
      data: {
        commercialSituationId: updated.id,
        ...fields,
        status: updated.status,
        approvalStatus: updated.approvalStatus,
        confidence: updated.confidence,
        versionNumber: nextVersion,
        changeType: "UPDATED",
        changedById: params.actorUserId,
        changeNote: params.changeNote ?? null,
      },
    });
    return updated;
  });

  await upsertStrategicEntity({
    clientId: situation.clientId,
    entityType: "COMMERCIAL_SITUATION",
    entityId: situation.id,
    title: situation.title,
    status: situation.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: situation.clientId,
    actorUserId: params.actorUserId,
    action: "UPDATE",
    entityType: "CommercialSituation",
    entityId: situation.id,
  });

  return situation;
}

export async function setCommercialSituationApprovalStatus(params: {
  situationId: string;
  organizationId: string;
  actorUserId: string;
  approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW";
}) {
  const existing = await prisma.commercialSituation.findUniqueOrThrow({ where: { id: params.situationId } });

  const situation = await prisma.commercialSituation.update({
    where: { id: params.situationId },
    data: {
      approvalStatus: params.approvalStatus,
      status: params.approvalStatus === "APPROVED" ? "ACTIVE" : existing.status,
    },
  });

  await upsertStrategicEntity({
    clientId: situation.clientId,
    entityType: "COMMERCIAL_SITUATION",
    entityId: situation.id,
    title: situation.title,
    status: situation.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: situation.clientId,
    actorUserId: params.actorUserId,
    action: params.approvalStatus === "APPROVED" ? "APPROVE" : params.approvalStatus === "REJECTED" ? "REJECT" : "UPDATE",
    entityType: "CommercialSituation",
    entityId: situation.id,
    metadata: { approvalStatus: params.approvalStatus },
  });

  return situation;
}

export async function archiveCommercialSituation(params: { situationId: string; organizationId: string; actorUserId: string }) {
  const situation = await prisma.commercialSituation.update({
    where: { id: params.situationId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  await removeStrategicEntity({ clientId: situation.clientId, entityType: "COMMERCIAL_SITUATION", entityId: situation.id });

  await logAudit({
    organizationId: params.organizationId,
    clientId: situation.clientId,
    actorUserId: params.actorUserId,
    action: "ARCHIVE",
    entityType: "CommercialSituation",
    entityId: situation.id,
  });

  return situation;
}

export function listCommercialSituations(clientId: string) {
  return prisma.commercialSituation.findMany({
    where: { clientId, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    include: { cohort: { select: { id: true, name: true } } },
  });
}

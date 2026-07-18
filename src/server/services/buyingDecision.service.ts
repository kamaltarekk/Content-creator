import "server-only";

import type { DecisionType } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { upsertStrategicEntity, removeStrategicEntity } from "@/server/services/strategicEntity.service";

export type BuyingDecisionFields = {
  title: string;
  decisionType: DecisionType;
  description?: string | null;
  timeframe?: string | null;
  commercialSituationId?: string | null;
};

function orNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

function normalize(input: BuyingDecisionFields) {
  return {
    title: input.title,
    decisionType: input.decisionType,
    description: orNull(input.description),
    timeframe: orNull(input.timeframe),
  };
}

export async function createBuyingDecision(params: {
  clientId: string;
  cohortId: string;
  organizationId: string;
  actorUserId: string;
  input: BuyingDecisionFields;
}) {
  const fields = normalize(params.input);
  const commercialSituationId = orNull(params.input.commercialSituationId);

  const decision = await prisma.$transaction(async (tx) => {
    const created = await tx.buyingDecision.create({
      data: {
        clientId: params.clientId,
        cohortId: params.cohortId,
        commercialSituationId,
        ...fields,
        status: "DRAFT",
        approvalStatus: "DRAFT",
        currentVersionNumber: 1,
        createdById: params.actorUserId,
      },
    });
    await tx.buyingDecisionVersion.create({
      data: {
        buyingDecisionId: created.id,
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
    entityType: "BUYING_DECISION",
    entityId: decision.id,
    title: decision.title,
    status: decision.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.actorUserId,
    action: "CREATE",
    entityType: "BuyingDecision",
    entityId: decision.id,
    metadata: { cohortId: params.cohortId, title: decision.title },
  });

  return decision;
}

export async function updateBuyingDecision(params: {
  decisionId: string;
  organizationId: string;
  actorUserId: string;
  input: BuyingDecisionFields;
  changeNote?: string;
}) {
  const existing = await prisma.buyingDecision.findUniqueOrThrow({ where: { id: params.decisionId } });
  const fields = normalize(params.input);
  const commercialSituationId = orNull(params.input.commercialSituationId);
  const nextVersion = existing.currentVersionNumber + 1;

  const decision = await prisma.$transaction(async (tx) => {
    const updated = await tx.buyingDecision.update({
      where: { id: params.decisionId },
      data: { ...fields, commercialSituationId, currentVersionNumber: nextVersion },
    });
    await tx.buyingDecisionVersion.create({
      data: {
        buyingDecisionId: updated.id,
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
    clientId: decision.clientId,
    entityType: "BUYING_DECISION",
    entityId: decision.id,
    title: decision.title,
    status: decision.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: decision.clientId,
    actorUserId: params.actorUserId,
    action: "UPDATE",
    entityType: "BuyingDecision",
    entityId: decision.id,
  });

  return decision;
}

export async function setBuyingDecisionApprovalStatus(params: {
  decisionId: string;
  organizationId: string;
  actorUserId: string;
  approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW";
}) {
  const existing = await prisma.buyingDecision.findUniqueOrThrow({ where: { id: params.decisionId } });

  const decision = await prisma.buyingDecision.update({
    where: { id: params.decisionId },
    data: {
      approvalStatus: params.approvalStatus,
      status: params.approvalStatus === "APPROVED" ? "ACTIVE" : existing.status,
    },
  });

  await upsertStrategicEntity({
    clientId: decision.clientId,
    entityType: "BUYING_DECISION",
    entityId: decision.id,
    title: decision.title,
    status: decision.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: decision.clientId,
    actorUserId: params.actorUserId,
    action: params.approvalStatus === "APPROVED" ? "APPROVE" : params.approvalStatus === "REJECTED" ? "REJECT" : "UPDATE",
    entityType: "BuyingDecision",
    entityId: decision.id,
    metadata: { approvalStatus: params.approvalStatus },
  });

  return decision;
}

export async function archiveBuyingDecision(params: { decisionId: string; organizationId: string; actorUserId: string }) {
  const decision = await prisma.buyingDecision.update({
    where: { id: params.decisionId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  await removeStrategicEntity({ clientId: decision.clientId, entityType: "BUYING_DECISION", entityId: decision.id });

  await logAudit({
    organizationId: params.organizationId,
    clientId: decision.clientId,
    actorUserId: params.actorUserId,
    action: "ARCHIVE",
    entityType: "BuyingDecision",
    entityId: decision.id,
  });

  return decision;
}

export function listBuyingDecisions(clientId: string) {
  return prisma.buyingDecision.findMany({
    where: { clientId, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    include: {
      cohort: { select: { id: true, name: true } },
      commercialSituation: { select: { id: true, title: true } },
      participants: true,
      objections: true,
      criteria: true,
    },
  });
}

export async function getBuyingDecisionDetail(decisionId: string) {
  return prisma.buyingDecision.findUnique({
    where: { id: decisionId },
    include: {
      cohort: { select: { id: true, name: true } },
      commercialSituation: { select: { id: true, title: true } },
      participants: { orderBy: { createdAt: "asc" } },
      objections: { orderBy: { createdAt: "asc" } },
      criteria: { orderBy: { createdAt: "asc" } },
      versions: { orderBy: { versionNumber: "desc" } },
    },
  });
}

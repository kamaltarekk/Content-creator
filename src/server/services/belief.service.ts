import "server-only";

import type { BeliefType } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { upsertStrategicEntity, removeStrategicEntity } from "@/server/services/strategicEntity.service";
import { validateBeliefQuality, type BeliefQualityResult } from "@/server/domain/belief-quality";

export type BeliefMapFields = {
  observedSituation?: string | null;
  currentInterpretation?: string | null;
  currentBeliefStatement: string;
  beliefType?: BeliefType;
  behaviorCaused?: string | null;
  commercialConsequence?: string | null;
  betterBeliefStatement?: string | null;
  betterCommercialDecision?: string | null;
  relevantOfferPlaceholder?: string | null;
  commercialSituationId?: string | null;
};

function orNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

function normalize(input: BeliefMapFields) {
  return {
    observedSituation: orNull(input.observedSituation),
    currentInterpretation: orNull(input.currentInterpretation),
    currentBeliefStatement: input.currentBeliefStatement,
    beliefType: input.beliefType ?? "WRONG",
    behaviorCaused: orNull(input.behaviorCaused),
    commercialConsequence: orNull(input.commercialConsequence),
    betterBeliefStatement: orNull(input.betterBeliefStatement),
    betterCommercialDecision: orNull(input.betterCommercialDecision),
    relevantOfferPlaceholder: orNull(input.relevantOfferPlaceholder),
  };
}

function beliefTitle(currentBeliefStatement: string) {
  return currentBeliefStatement.length > 80 ? `${currentBeliefStatement.slice(0, 77)}...` : currentBeliefStatement;
}

export async function createBeliefMap(params: {
  clientId: string;
  cohortId: string;
  organizationId: string;
  actorUserId: string;
  input: BeliefMapFields;
}) {
  const fields = normalize(params.input);
  const commercialSituationId = orNull(params.input.commercialSituationId);

  const belief = await prisma.$transaction(async (tx) => {
    const created = await tx.beliefMap.create({
      data: {
        clientId: params.clientId,
        cohortId: params.cohortId,
        commercialSituationId,
        ...fields,
        approvalStatus: "DRAFT",
        currentVersionNumber: 1,
        createdById: params.actorUserId,
      },
    });
    await tx.beliefMapVersion.create({
      data: {
        beliefMapId: created.id,
        ...fields,
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
    entityType: "BELIEF",
    entityId: belief.id,
    title: beliefTitle(belief.currentBeliefStatement),
    status: belief.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.actorUserId,
    action: "CREATE",
    entityType: "BeliefMap",
    entityId: belief.id,
    metadata: { cohortId: params.cohortId },
  });

  return belief;
}

export async function updateBeliefMap(params: {
  beliefMapId: string;
  organizationId: string;
  actorUserId: string;
  input: BeliefMapFields;
  changeNote?: string;
}) {
  const existing = await prisma.beliefMap.findUniqueOrThrow({ where: { id: params.beliefMapId } });
  const fields = normalize(params.input);
  const commercialSituationId = orNull(params.input.commercialSituationId);
  const nextVersion = existing.currentVersionNumber + 1;

  const belief = await prisma.$transaction(async (tx) => {
    const updated = await tx.beliefMap.update({
      where: { id: params.beliefMapId },
      data: { ...fields, commercialSituationId, currentVersionNumber: nextVersion },
    });
    await tx.beliefMapVersion.create({
      data: {
        beliefMapId: updated.id,
        ...fields,
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
    clientId: belief.clientId,
    entityType: "BELIEF",
    entityId: belief.id,
    title: beliefTitle(belief.currentBeliefStatement),
    status: belief.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: belief.clientId,
    actorUserId: params.actorUserId,
    action: "UPDATE",
    entityType: "BeliefMap",
    entityId: belief.id,
  });

  return belief;
}

export async function setBeliefMapApprovalStatus(params: {
  beliefMapId: string;
  organizationId: string;
  actorUserId: string;
  approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW";
}) {
  const belief = await prisma.beliefMap.update({
    where: { id: params.beliefMapId },
    data: { approvalStatus: params.approvalStatus },
  });

  await upsertStrategicEntity({
    clientId: belief.clientId,
    entityType: "BELIEF",
    entityId: belief.id,
    title: beliefTitle(belief.currentBeliefStatement),
    status: belief.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: belief.clientId,
    actorUserId: params.actorUserId,
    action: params.approvalStatus === "APPROVED" ? "APPROVE" : params.approvalStatus === "REJECTED" ? "REJECT" : "UPDATE",
    entityType: "BeliefMap",
    entityId: belief.id,
    metadata: { approvalStatus: params.approvalStatus },
  });

  return belief;
}

export async function archiveBeliefMap(params: { beliefMapId: string; organizationId: string; actorUserId: string }) {
  const belief = await prisma.beliefMap.update({
    where: { id: params.beliefMapId },
    data: { archivedAt: new Date() },
  });

  await removeStrategicEntity({ clientId: belief.clientId, entityType: "BELIEF", entityId: belief.id });

  await logAudit({
    organizationId: params.organizationId,
    clientId: belief.clientId,
    actorUserId: params.actorUserId,
    action: "ARCHIVE",
    entityType: "BeliefMap",
    entityId: belief.id,
  });

  return belief;
}

function qualityFor(belief: { currentBeliefStatement: string; behaviorCaused: string | null; commercialConsequence: string | null; betterBeliefStatement: string | null; betterCommercialDecision: string | null; evidenceLinks: unknown[] }): BeliefQualityResult {
  return validateBeliefQuality({
    currentBeliefStatement: belief.currentBeliefStatement,
    behaviorCaused: belief.behaviorCaused,
    commercialConsequence: belief.commercialConsequence,
    betterBeliefStatement: belief.betterBeliefStatement,
    betterCommercialDecision: belief.betterCommercialDecision,
    hasEvidence: belief.evidenceLinks.length > 0,
  });
}

export async function listBeliefMaps(clientId: string) {
  const beliefs = await prisma.beliefMap.findMany({
    where: { clientId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      cohort: { select: { id: true, name: true } },
      evidenceLinks: true,
    },
  });
  return beliefs.map((belief) => ({ ...belief, quality: qualityFor(belief) }));
}

export async function getBeliefMapDetail(beliefMapId: string) {
  const belief = await prisma.beliefMap.findUnique({
    where: { id: beliefMapId },
    include: {
      cohort: { select: { id: true, name: true } },
      commercialSituation: { select: { id: true, title: true } },
      evidenceLinks: { orderBy: { createdAt: "desc" } },
      versions: { orderBy: { versionNumber: "desc" } },
    },
  });
  if (!belief) return null;
  return { ...belief, quality: qualityFor(belief) };
}

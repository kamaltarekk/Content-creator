import "server-only";

import type { CohortPriority, CohortSourceRelationshipType } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { upsertStrategicEntity, removeStrategicEntity } from "@/server/services/strategicEntity.service";
import { validateCohortQuality, type CohortQualityResult } from "@/server/domain/cohort-quality";

export type CohortFields = {
  name: string;
  definition?: string | null;
  priority?: CohortPriority;
  role?: string | null;
  commercialContext?: string | null;
  currentWorkflow?: string | null;
  currentBelief?: string | null;
  desiredOutcome?: string | null;
  decisionRisk?: string | null;
  emotionalDrivers?: string[];
  platformPresence?: string[];
  attentionNotes?: string | null;
};

function orNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

function normalize(input: CohortFields) {
  return {
    name: input.name,
    definition: orNull(input.definition),
    priority: input.priority ?? "MEDIUM",
    role: orNull(input.role),
    commercialContext: orNull(input.commercialContext),
    currentWorkflow: orNull(input.currentWorkflow),
    currentBelief: orNull(input.currentBelief),
    desiredOutcome: orNull(input.desiredOutcome),
    decisionRisk: orNull(input.decisionRisk),
    emotionalDrivers: input.emotionalDrivers ?? [],
    platformPresence: input.platformPresence ?? [],
    attentionNotes: orNull(input.attentionNotes),
  };
}

export async function createCohort(params: {
  clientId: string;
  organizationId: string;
  actorUserId: string;
  input: CohortFields;
}) {
  const fields = normalize(params.input);

  const cohort = await prisma.$transaction(async (tx) => {
    const created = await tx.cohort.create({
      data: {
        clientId: params.clientId,
        ...fields,
        status: "DRAFT",
        approvalStatus: "DRAFT",
        currentVersionNumber: 1,
        createdById: params.actorUserId,
      },
    });
    await tx.cohortVersion.create({
      data: {
        cohortId: created.id,
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
    entityType: "COHORT",
    entityId: cohort.id,
    title: cohort.name,
    status: cohort.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.actorUserId,
    action: "CREATE",
    entityType: "Cohort",
    entityId: cohort.id,
    metadata: { name: cohort.name },
  });

  return cohort;
}

export async function updateCohort(params: {
  cohortId: string;
  organizationId: string;
  actorUserId: string;
  input: CohortFields;
  changeNote?: string;
}) {
  const existing = await prisma.cohort.findUniqueOrThrow({ where: { id: params.cohortId } });
  const fields = normalize(params.input);
  const nextVersion = existing.currentVersionNumber + 1;

  const cohort = await prisma.$transaction(async (tx) => {
    const updated = await tx.cohort.update({
      where: { id: params.cohortId },
      data: { ...fields, currentVersionNumber: nextVersion, updatedById: params.actorUserId },
    });
    await tx.cohortVersion.create({
      data: {
        cohortId: updated.id,
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
    clientId: cohort.clientId,
    entityType: "COHORT",
    entityId: cohort.id,
    title: cohort.name,
    status: cohort.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: cohort.clientId,
    actorUserId: params.actorUserId,
    action: "UPDATE",
    entityType: "Cohort",
    entityId: cohort.id,
  });

  return cohort;
}

export async function setCohortApprovalStatus(params: {
  cohortId: string;
  organizationId: string;
  actorUserId: string;
  approvalStatus: "APPROVED" | "REJECTED" | "DISPUTED" | "UNDER_REVIEW";
}) {
  const existing = await prisma.cohort.findUniqueOrThrow({ where: { id: params.cohortId } });
  const nextVersion = existing.currentVersionNumber + 1;

  const cohort = await prisma.$transaction(async (tx) => {
    const updated = await tx.cohort.update({
      where: { id: params.cohortId },
      data: {
        approvalStatus: params.approvalStatus,
        status: params.approvalStatus === "APPROVED" ? "ACTIVE" : existing.status,
        currentVersionNumber: nextVersion,
        updatedById: params.actorUserId,
      },
    });
    await tx.cohortVersion.create({
      data: {
        cohortId: updated.id,
        name: updated.name,
        definition: updated.definition,
        priority: updated.priority,
        role: updated.role,
        commercialContext: updated.commercialContext,
        currentWorkflow: updated.currentWorkflow,
        currentBelief: updated.currentBelief,
        desiredOutcome: updated.desiredOutcome,
        decisionRisk: updated.decisionRisk,
        emotionalDrivers: updated.emotionalDrivers,
        platformPresence: updated.platformPresence,
        attentionNotes: updated.attentionNotes,
        status: updated.status,
        approvalStatus: updated.approvalStatus,
        confidence: updated.confidence,
        versionNumber: nextVersion,
        changeType: "UPDATED",
        changedById: params.actorUserId,
        changeNote: `Approval status set to ${params.approvalStatus}`,
      },
    });
    return updated;
  });

  await upsertStrategicEntity({
    clientId: cohort.clientId,
    entityType: "COHORT",
    entityId: cohort.id,
    title: cohort.name,
    status: cohort.approvalStatus,
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: cohort.clientId,
    actorUserId: params.actorUserId,
    action: params.approvalStatus === "APPROVED" ? "APPROVE" : params.approvalStatus === "REJECTED" ? "REJECT" : "UPDATE",
    entityType: "Cohort",
    entityId: cohort.id,
    metadata: { approvalStatus: params.approvalStatus },
  });

  return cohort;
}

export async function archiveCohort(params: { cohortId: string; organizationId: string; actorUserId: string }) {
  const cohort = await prisma.cohort.update({
    where: { id: params.cohortId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  await removeStrategicEntity({ clientId: cohort.clientId, entityType: "COHORT", entityId: cohort.id });

  await logAudit({
    organizationId: params.organizationId,
    clientId: cohort.clientId,
    actorUserId: params.actorUserId,
    action: "ARCHIVE",
    entityType: "Cohort",
    entityId: cohort.id,
  });

  return cohort;
}

export type CohortListItem = Awaited<ReturnType<typeof listCohorts>>[number];

export async function listCohorts(clientId: string) {
  const cohorts = await prisma.cohort.findMany({
    where: { clientId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: {
      commercialSituations: { select: { id: true, triggerDescription: true } },
      buyingDecisions: { select: { id: true } },
      beliefMaps: { select: { id: true, betterBeliefStatement: true } },
      _count: { select: { sourceReferences: true } },
    },
  });

  return cohorts.map((cohort) => {
    const quality = validateCohortQuality({
      name: cohort.name,
      definition: cohort.definition,
      role: cohort.role,
      commercialContext: cohort.commercialContext,
      currentWorkflow: cohort.currentWorkflow,
      currentBelief: cohort.currentBelief,
      desiredOutcome: cohort.desiredOutcome,
      decisionRisk: cohort.decisionRisk,
      hasCommercialSituation: cohort.commercialSituations.length > 0,
      hasTrigger: cohort.commercialSituations.some((s) => Boolean(s.triggerDescription)),
      hasBuyingDecision: cohort.buyingDecisions.length > 0,
    });
    return { ...cohort, quality };
  });
}

export async function getCohortDetail(cohortId: string) {
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: {
      commercialSituations: { orderBy: { createdAt: "asc" } },
      buyingDecisions: {
        orderBy: { createdAt: "asc" },
        include: { participants: true, objections: true, criteria: true },
      },
      beliefMaps: { orderBy: { createdAt: "asc" }, include: { evidenceLinks: true } },
      sourceReferences: { orderBy: { linkedAt: "desc" } },
      versions: { orderBy: { versionNumber: "desc" } },
    },
  });
  if (!cohort) return null;

  const quality: CohortQualityResult = validateCohortQuality({
    name: cohort.name,
    definition: cohort.definition,
    role: cohort.role,
    commercialContext: cohort.commercialContext,
    currentWorkflow: cohort.currentWorkflow,
    currentBelief: cohort.currentBelief,
    desiredOutcome: cohort.desiredOutcome,
    decisionRisk: cohort.decisionRisk,
    hasCommercialSituation: cohort.commercialSituations.length > 0,
    hasTrigger: cohort.commercialSituations.some((s) => Boolean(s.triggerDescription)),
    hasBuyingDecision: cohort.buyingDecisions.length > 0,
  });

  return { ...cohort, quality };
}

export async function addCohortSourceReference(params: {
  cohortId: string;
  organizationId: string;
  linkedById: string;
  relationshipType: CohortSourceRelationshipType;
  clientBrainItemId?: string;
  extractedItemId?: string;
  sourceId?: string;
  sourceBlockId?: string;
  audienceSignalNote?: string;
  note?: string;
}) {
  const cohort = await prisma.cohort.findUniqueOrThrow({ where: { id: params.cohortId } });

  const reference = await prisma.cohortSourceReference.create({
    data: {
      cohortId: params.cohortId,
      relationshipType: params.relationshipType,
      clientBrainItemId: params.clientBrainItemId ?? null,
      extractedItemId: params.extractedItemId ?? null,
      sourceId: params.sourceId ?? null,
      sourceBlockId: params.sourceBlockId ?? null,
      audienceSignalNote: params.audienceSignalNote ?? null,
      note: params.note ?? null,
      linkedById: params.linkedById,
    },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: cohort.clientId,
    actorUserId: params.linkedById,
    action: "CREATE",
    entityType: "CohortSourceReference",
    entityId: reference.id,
    metadata: { relationshipType: params.relationshipType },
  });

  return reference;
}

/**
 * Merges a duplicate cohort candidate into the primary: reassigns its
 * commercial situations, buying decisions, and belief maps, then archives
 * the duplicate. Never deletes data — the duplicate row and its version
 * history remain for audit purposes.
 */
export async function mergeCohorts(params: {
  primaryCohortId: string;
  duplicateCohortId: string;
  organizationId: string;
  actorUserId: string;
}) {
  if (params.primaryCohortId === params.duplicateCohortId) {
    throw new Error("Cannot merge a cohort into itself.");
  }

  const [primary, duplicate] = await Promise.all([
    prisma.cohort.findUniqueOrThrow({ where: { id: params.primaryCohortId } }),
    prisma.cohort.findUniqueOrThrow({ where: { id: params.duplicateCohortId } }),
  ]);
  if (primary.clientId !== duplicate.clientId) {
    throw new Error("Cannot merge cohorts across different clients.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.commercialSituation.updateMany({
      where: { cohortId: params.duplicateCohortId },
      data: { cohortId: params.primaryCohortId },
    });
    await tx.buyingDecision.updateMany({
      where: { cohortId: params.duplicateCohortId },
      data: { cohortId: params.primaryCohortId },
    });
    await tx.beliefMap.updateMany({
      where: { cohortId: params.duplicateCohortId },
      data: { cohortId: params.primaryCohortId },
    });
    await tx.cohortSourceReference.updateMany({
      where: { cohortId: params.duplicateCohortId },
      data: { cohortId: params.primaryCohortId },
    });
    await tx.cohort.update({
      where: { id: params.duplicateCohortId },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
  });

  await removeStrategicEntity({ clientId: duplicate.clientId, entityType: "COHORT", entityId: duplicate.id });

  await logAudit({
    organizationId: params.organizationId,
    clientId: primary.clientId,
    actorUserId: params.actorUserId,
    action: "MERGE",
    entityType: "Cohort",
    entityId: primary.id,
    metadata: { mergedFromCohortId: duplicate.id, mergedFromName: duplicate.name },
  });

  return primary;
}

/**
 * Splits a cohort into two: creates a new cohort cloned from the source with
 * the given field overrides (e.g. a distinct sub-situation), leaving the
 * original untouched. The two remain independently editable.
 */
export async function splitCohort(params: {
  cohortId: string;
  organizationId: string;
  actorUserId: string;
  overrides: CohortFields;
}) {
  const source = await prisma.cohort.findUniqueOrThrow({ where: { id: params.cohortId } });

  const newCohort = await createCohort({
    clientId: source.clientId,
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    input: normalize({ ...source, ...params.overrides }),
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: source.clientId,
    actorUserId: params.actorUserId,
    action: "SPLIT",
    entityType: "Cohort",
    entityId: source.id,
    metadata: { splitIntoCohortId: newCohort.id },
  });

  return newCohort;
}

import "server-only";

import type { BuyingRole, CohortPriority } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";

function orNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

// ---- Buying role participants (the committee) ----

export async function addBuyingRoleParticipant(params: {
  buyingDecisionId: string;
  organizationId: string;
  actorUserId: string;
  input: { role: BuyingRole; label: string; influenceScore?: number | null; stance?: string | null; notes?: string | null };
}) {
  const decision = await prisma.buyingDecision.findUniqueOrThrow({ where: { id: params.buyingDecisionId } });

  const participant = await prisma.buyingRoleParticipant.create({
    data: {
      buyingDecisionId: params.buyingDecisionId,
      clientId: decision.clientId,
      role: params.input.role,
      label: params.input.label,
      influenceScore: params.input.influenceScore ?? null,
      stance: orNull(params.input.stance),
      notes: orNull(params.input.notes),
      createdById: params.actorUserId,
    },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: decision.clientId,
    actorUserId: params.actorUserId,
    action: "CREATE",
    entityType: "BuyingRoleParticipant",
    entityId: participant.id,
    metadata: { buyingDecisionId: params.buyingDecisionId, role: params.input.role, label: params.input.label },
  });

  return participant;
}

export async function removeBuyingRoleParticipant(params: { participantId: string; organizationId: string; actorUserId: string }) {
  const participant = await prisma.buyingRoleParticipant.findUniqueOrThrow({ where: { id: params.participantId } });
  await prisma.buyingRoleParticipant.delete({ where: { id: params.participantId } });

  await logAudit({
    organizationId: params.organizationId,
    clientId: participant.clientId,
    actorUserId: params.actorUserId,
    action: "SOFT_DELETE",
    entityType: "BuyingRoleParticipant",
    entityId: participant.id,
    metadata: { buyingDecisionId: participant.buyingDecisionId },
  });

  return participant;
}

// ---- Objections ----

export async function addObjection(params: {
  buyingDecisionId: string;
  organizationId: string;
  actorUserId: string;
  input: {
    title: string;
    description?: string | null;
    raisedByRole?: BuyingRole | null;
    severity?: CohortPriority;
  };
}) {
  const decision = await prisma.buyingDecision.findUniqueOrThrow({ where: { id: params.buyingDecisionId } });

  const objection = await prisma.objection.create({
    data: {
      buyingDecisionId: params.buyingDecisionId,
      clientId: decision.clientId,
      title: params.input.title,
      description: orNull(params.input.description),
      raisedByRole: params.input.raisedByRole ?? null,
      severity: params.input.severity ?? "MEDIUM",
      createdById: params.actorUserId,
    },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: decision.clientId,
    actorUserId: params.actorUserId,
    action: "CREATE",
    entityType: "Objection",
    entityId: objection.id,
    metadata: { buyingDecisionId: params.buyingDecisionId, title: objection.title },
  });

  return objection;
}

export async function resolveObjection(params: {
  objectionId: string;
  organizationId: string;
  actorUserId: string;
  resolutionNote: string;
}) {
  const objection = await prisma.objection.update({
    where: { id: params.objectionId },
    data: { resolutionNote: params.resolutionNote, status: "ARCHIVED" },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: objection.clientId,
    actorUserId: params.actorUserId,
    action: "UPDATE",
    entityType: "Objection",
    entityId: objection.id,
    metadata: { resolved: true },
  });

  return objection;
}

export async function removeObjection(params: { objectionId: string; organizationId: string; actorUserId: string }) {
  const objection = await prisma.objection.findUniqueOrThrow({ where: { id: params.objectionId } });
  await prisma.objection.delete({ where: { id: params.objectionId } });

  await logAudit({
    organizationId: params.organizationId,
    clientId: objection.clientId,
    actorUserId: params.actorUserId,
    action: "SOFT_DELETE",
    entityType: "Objection",
    entityId: objection.id,
  });

  return objection;
}

// ---- Decision criteria ----

export async function addDecisionCriterion(params: {
  buyingDecisionId: string;
  organizationId: string;
  actorUserId: string;
  input: { label: string; weightNote?: string | null; importance?: CohortPriority };
}) {
  const decision = await prisma.buyingDecision.findUniqueOrThrow({ where: { id: params.buyingDecisionId } });

  const criterion = await prisma.decisionCriterion.create({
    data: {
      buyingDecisionId: params.buyingDecisionId,
      clientId: decision.clientId,
      label: params.input.label,
      weightNote: orNull(params.input.weightNote),
      importance: params.input.importance ?? "MEDIUM",
      createdById: params.actorUserId,
    },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: decision.clientId,
    actorUserId: params.actorUserId,
    action: "CREATE",
    entityType: "DecisionCriterion",
    entityId: criterion.id,
    metadata: { buyingDecisionId: params.buyingDecisionId },
  });

  return criterion;
}

export async function removeDecisionCriterion(params: { criterionId: string; organizationId: string; actorUserId: string }) {
  const criterion = await prisma.decisionCriterion.findUniqueOrThrow({ where: { id: params.criterionId } });
  await prisma.decisionCriterion.delete({ where: { id: params.criterionId } });

  await logAudit({
    organizationId: params.organizationId,
    clientId: criterion.clientId,
    actorUserId: params.actorUserId,
    action: "SOFT_DELETE",
    entityType: "DecisionCriterion",
    entityId: criterion.id,
  });

  return criterion;
}

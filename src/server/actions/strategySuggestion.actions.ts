"use server";

import { revalidatePath } from "next/cache";
import type { StrategicEntityType, StrategySuggestionAction, StrategySuggestionType } from "@prisma/client";

import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import * as suggestionService from "@/server/services/strategySuggestion.service";

export async function generateStrategySuggestionAction(clientId: string, targetType: StrategySuggestionType) {
  const session = await requireAction("strategy.suggest", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const suggestion = await suggestionService.generateStrategySuggestion({
    clientId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    targetType,
  });

  revalidatePath(`/c/${clientId}/strategy/reviews`);
  return { suggestionId: suggestion.id };
}

export async function resolveSuggestionAction(input: {
  suggestionId: string;
  clientId: string;
  action: StrategySuggestionAction;
  targetCohortId?: string;
  targetDecisionId?: string;
  targetEntityType?: StrategicEntityType;
  targetEntityId?: string;
  edits?: Record<string, string>;
  resolutionNote?: string;
}) {
  const requiredAction =
    input.action === "APPROVE" || input.action === "EDIT_APPROVE" || input.action === "MERGE"
      ? "strategy.approve"
      : "strategy.edit";
  const session = await requireAction(requiredAction, { clientId: input.clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const result = await suggestionService.resolveSuggestion({
    suggestionId: input.suggestionId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    action: input.action,
    targetCohortId: input.targetCohortId,
    targetDecisionId: input.targetDecisionId,
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId,
    edits: input.edits,
    resolutionNote: input.resolutionNote,
  });

  revalidatePath(`/c/${input.clientId}/strategy/reviews`);
  revalidatePath(`/c/${input.clientId}/strategy`);
  return result;
}

export async function bulkApproveSuggestionsAction(clientId: string, suggestionIds: string[]) {
  const session = await requireAction("strategy.approve", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const result = await suggestionService.bulkApproveSuggestions({
    clientId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    suggestionIds,
  });

  revalidatePath(`/c/${clientId}/strategy/reviews`);
  revalidatePath(`/c/${clientId}/strategy`);
  return result;
}

/** Cohorts + buying decisions + beliefs available as attach/parent targets in the review UI. */
export async function listReviewTargetsAction(clientId: string) {
  await requireAction("strategy.view", { clientId });
  const [cohorts, decisions, beliefs] = await Promise.all([
    prisma.cohort.findMany({ where: { clientId, status: { not: "ARCHIVED" } }, select: { id: true, name: true } }),
    prisma.buyingDecision.findMany({ where: { clientId, status: { not: "ARCHIVED" } }, select: { id: true, title: true } }),
    prisma.beliefMap.findMany({ where: { clientId, archivedAt: null }, select: { id: true, currentBeliefStatement: true } }),
  ]);
  return { cohorts, decisions, beliefs };
}

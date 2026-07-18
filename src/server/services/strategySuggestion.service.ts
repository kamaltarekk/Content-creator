import "server-only";

import pLimit from "p-limit";
import type { Prisma, StrategySuggestionAction, StrategySuggestionType } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { getAIProvider } from "@/server/providers/ai/openai.provider";
import type { AIProvider } from "@/server/providers/ai/ai.provider";
import { isBulkApprovable } from "@/server/domain/strategy-conflict";
import { detectSuggestionDuplicate } from "@/server/services/strategyConflict.service";
import { createCohort, setCohortApprovalStatus, mergeCohorts, addCohortSourceReference } from "@/server/services/cohort.service";
import { createCommercialSituation, setCommercialSituationApprovalStatus } from "@/server/services/commercialSituation.service";
import { createBuyingDecision, setBuyingDecisionApprovalStatus } from "@/server/services/buyingDecision.service";
import { addBuyingRoleParticipant } from "@/server/services/buyingCommittee.service";
import { createBeliefMap, setBeliefMapApprovalStatus } from "@/server/services/belief.service";
import { addEvidenceLink } from "@/server/services/evidenceLink.service";
import { createStrategicRelationship } from "@/server/services/strategicRelationship.service";

const limit = pLimit(4);

// ---- Generation ----

function asStr(fields: Record<string, unknown>, key: string): string | null {
  const value = fields[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function asNum(fields: Record<string, unknown>, key: string): number | null {
  const value = fields[key];
  return typeof value === "number" ? value : null;
}

async function buildBrainDigest(clientId: string): Promise<string> {
  const items = await prisma.clientBrainItem.findMany({
    where: { clientId, status: "ACTIVE", sectionKey: { in: ["COHORTS", "BELIEFS", "MARKETS", "POSITIONING"] } },
    select: { sectionKey: true, fieldKey: true, valueText: true, subjectLabel: true },
    take: 60,
  });
  return items.map((i) => `[${i.sectionKey}] ${i.subjectLabel ?? i.fieldKey}: ${i.valueText ?? ""}`).join("\n");
}

async function buildStrategyDigest(clientId: string): Promise<string> {
  const [cohorts, beliefs] = await Promise.all([
    prisma.cohort.findMany({
      where: { clientId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
      take: 40,
    }),
    prisma.beliefMap.findMany({
      where: { clientId, archivedAt: null },
      select: { id: true, currentBeliefStatement: true },
      take: 40,
    }),
  ]);
  const cohortLines = cohorts.map((c) => `Cohort id=${c.id}: ${c.name}`);
  const beliefLines = beliefs.map((b) => `Belief id=${b.id}: ${b.currentBeliefStatement}`);
  return [...cohortLines, ...beliefLines].join("\n");
}

async function buildAudienceSignals(clientId: string): Promise<string[]> {
  const items = await prisma.extractedItem.findMany({
    where: { source: { clientId }, informationType: "AUDIENCE_SIGNAL" },
    select: { normalizedValueText: true },
    take: 15,
  });
  return items.map((i) => i.normalizedValueText ?? "").filter(Boolean);
}

export async function generateStrategySuggestion(params: {
  clientId: string;
  organizationId: string;
  actorUserId: string;
  targetType: StrategySuggestionType;
  providerOverride?: AIProvider;
}) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: params.clientId } });
  const provider = params.providerOverride ?? getAIProvider();

  const [existingBrainDigest, existingStrategyDigest, selectedAudienceSignals] = await Promise.all([
    buildBrainDigest(params.clientId),
    buildStrategyDigest(params.clientId),
    buildAudienceSignals(params.clientId),
  ]);

  const result = await limit(() =>
    provider.suggestStrategy({
      clientId: params.clientId,
      targetType: params.targetType,
      context: {
        clientName: client.displayName,
        brandType: client.brandType,
        existingBrainDigest,
        existingStrategyDigest,
        selectedAudienceSignals,
      },
    }),
  );

  const duplicate = await detectSuggestionDuplicate({
    clientId: params.clientId,
    suggestionType: result.suggestion_type,
    proposedFields: result.proposed_fields,
  });

  const suggestion = await prisma.$transaction(async (tx) => {
    const created = await tx.strategySuggestion.create({
      data: {
        clientId: params.clientId,
        suggestionType: result.suggestion_type,
        title: result.title,
        proposedFields: result.proposed_fields as Prisma.InputJsonValue,
        sourceReferences: result.source_references as unknown as Prisma.InputJsonValue,
        confidence: result.confidence,
        reasoningSummary: result.reasoning_summary,
        missingEvidence: result.missing_evidence,
        possibleConflicts: result.possible_conflicts as unknown as Prisma.InputJsonValue,
        suggestedRelationships: result.suggested_relationships as unknown as Prisma.InputJsonValue,
        status: "AI_SUGGESTED",
        isDuplicateCandidate: Boolean(duplicate) || result.possible_conflicts.length > 0,
        duplicateOfEntityType: duplicate?.entityType ?? null,
        duplicateOfEntityId: duplicate?.entityId ?? null,
      },
    });
    await tx.strategySuggestionReview.create({
      data: { strategySuggestionId: created.id, clientId: params.clientId, status: "PENDING" },
    });
    return created;
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.actorUserId,
    action: "SUGGEST",
    entityType: "StrategySuggestion",
    entityId: suggestion.id,
    metadata: { suggestionType: suggestion.suggestionType, confidence: suggestion.confidence },
  });

  return suggestion;
}

// ---- Review queue reads ----

export function listPendingSuggestions(clientId: string) {
  return prisma.strategySuggestion.findMany({
    where: { clientId, status: "AI_SUGGESTED" },
    orderBy: [{ isDuplicateCandidate: "desc" }, { confidence: "asc" }],
    include: { review: true },
  });
}

export function getSuggestionDetail(suggestionId: string) {
  return prisma.strategySuggestion.findUnique({ where: { id: suggestionId }, include: { review: true } });
}

// ---- Resolution ----

export type ResolveSuggestionParams = {
  suggestionId: string;
  organizationId: string;
  actorUserId: string;
  action: StrategySuggestionAction;
  /** Overrides the AI-proposed parent id when the reviewer picks a different (or missing) target. */
  targetCohortId?: string;
  targetDecisionId?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  /** Field-level overrides for EDIT_APPROVE. */
  edits?: Record<string, string>;
  resolutionNote?: string;
};

async function applySuggestionAsEntity(
  suggestion: { clientId: string; suggestionType: StrategySuggestionType; proposedFields: Prisma.JsonValue },
  params: ResolveSuggestionParams,
  approve: boolean,
) {
  const fields = { ...(suggestion.proposedFields as Record<string, unknown>), ...params.edits };
  const { clientId } = suggestion;
  const organizationId = params.organizationId;
  const actorUserId = params.actorUserId;

  switch (suggestion.suggestionType) {
    case "COHORT": {
      const cohort = await createCohort({
        clientId,
        organizationId,
        actorUserId,
        input: {
          name: asStr(fields, "name") ?? "Untitled cohort",
          definition: asStr(fields, "definition"),
          role: asStr(fields, "role"),
          commercialContext: asStr(fields, "commercialContext"),
          currentWorkflow: asStr(fields, "currentWorkflow"),
          currentBelief: asStr(fields, "currentBelief"),
          desiredOutcome: asStr(fields, "desiredOutcome"),
          decisionRisk: asStr(fields, "decisionRisk"),
          attentionNotes: asStr(fields, "attentionNotes"),
        },
      });
      if (approve) {
        await setCohortApprovalStatus({ cohortId: cohort.id, organizationId, actorUserId, approvalStatus: "APPROVED" });
      }
      return { entityType: "COHORT" as const, entityId: cohort.id };
    }
    case "COMMERCIAL_SITUATION": {
      const cohortId = params.targetCohortId ?? asStr(fields, "cohortId");
      if (!cohortId) throw new Error("A target cohort is required to create this commercial situation.");
      const situation = await createCommercialSituation({
        clientId,
        cohortId,
        organizationId,
        actorUserId,
        input: {
          title: asStr(fields, "title") ?? "Untitled situation",
          triggerType: (asStr(fields, "triggerType") as never) ?? "OTHER",
          triggerDescription: asStr(fields, "triggerDescription"),
          activeProblem: asStr(fields, "activeProblem"),
          currentWorkflow: asStr(fields, "currentWorkflow"),
          urgencyNote: asStr(fields, "urgencyNote"),
        },
      });
      if (approve) {
        await setCommercialSituationApprovalStatus({ situationId: situation.id, organizationId, actorUserId, approvalStatus: "APPROVED" });
      }
      return { entityType: "COMMERCIAL_SITUATION" as const, entityId: situation.id };
    }
    case "BUYING_DECISION": {
      const cohortId = params.targetCohortId ?? asStr(fields, "cohortId");
      if (!cohortId) throw new Error("A target cohort is required to create this buying decision.");
      const decision = await createBuyingDecision({
        clientId,
        cohortId,
        organizationId,
        actorUserId,
        input: {
          title: asStr(fields, "title") ?? "Untitled decision",
          decisionType: (asStr(fields, "decisionType") as never) ?? "OTHER",
          description: asStr(fields, "description"),
          timeframe: asStr(fields, "timeframe"),
        },
      });
      if (approve) {
        await setBuyingDecisionApprovalStatus({ decisionId: decision.id, organizationId, actorUserId, approvalStatus: "APPROVED" });
      }
      return { entityType: "BUYING_DECISION" as const, entityId: decision.id };
    }
    case "BUYING_ROLE_PARTICIPANT": {
      const buyingDecisionId = params.targetDecisionId ?? asStr(fields, "buyingDecisionId");
      if (!buyingDecisionId) throw new Error("A target buying decision is required to add this committee member.");
      const participant = await addBuyingRoleParticipant({
        buyingDecisionId,
        organizationId,
        actorUserId,
        input: {
          role: (asStr(fields, "role") as never) ?? "OTHER",
          label: asStr(fields, "label") ?? "Unnamed",
          influenceScore: asNum(fields, "influenceScore"),
          stance: asStr(fields, "stance"),
          notes: asStr(fields, "notes"),
        },
      });
      return { entityType: "BUYING_ROLE_PARTICIPANT" as const, entityId: participant.id };
    }
    case "BELIEF_MAP": {
      const cohortId = params.targetCohortId ?? asStr(fields, "cohortId");
      if (!cohortId) throw new Error("A target cohort is required to create this belief map.");
      const belief = await createBeliefMap({
        clientId,
        cohortId,
        organizationId,
        actorUserId,
        input: {
          currentBeliefStatement: asStr(fields, "currentBeliefStatement") ?? "Untitled belief",
          beliefType: (asStr(fields, "beliefType") as never) ?? "WRONG",
          observedSituation: asStr(fields, "observedSituation"),
          currentInterpretation: asStr(fields, "currentInterpretation"),
          behaviorCaused: asStr(fields, "behaviorCaused"),
          commercialConsequence: asStr(fields, "commercialConsequence"),
          betterBeliefStatement: asStr(fields, "betterBeliefStatement"),
          betterCommercialDecision: asStr(fields, "betterCommercialDecision"),
        },
      });
      if (approve) {
        await setBeliefMapApprovalStatus({ beliefMapId: belief.id, organizationId, actorUserId, approvalStatus: "APPROVED" });
      }
      return { entityType: "BELIEF" as const, entityId: belief.id };
    }
    case "EVIDENCE_LINK": {
      const targetEntityType = (params.targetEntityType ?? asStr(fields, "targetEntityType")) as never;
      const targetEntityId = params.targetEntityId ?? asStr(fields, "targetEntityId");
      if (!targetEntityType || !targetEntityId) throw new Error("A target entity is required to attach this evidence.");
      const link = await addEvidenceLink({
        clientId,
        organizationId,
        actorUserId,
        targetEntityType,
        targetEntityId,
        beliefMapId: targetEntityType === "BELIEF" ? targetEntityId : undefined,
        input: {
          description: asStr(fields, "description") ?? "Evidence",
          evidenceStrength: (asStr(fields, "evidenceStrength") as never) ?? "WEAK",
        },
      });
      return { entityType: "EVIDENCE" as const, entityId: link.id };
    }
    case "RELATIONSHIP": {
      const fromEntityId = asStr(fields, "fromEntityId");
      const toEntityId = asStr(fields, "toEntityId");
      const relationshipType = asStr(fields, "relationshipType");
      if (!fromEntityId || !toEntityId || !relationshipType) {
        throw new Error("Both entities and a relationship type are required.");
      }
      const relationship = await createStrategicRelationship({
        clientId,
        organizationId,
        actorUserId,
        fromEntityId,
        toEntityId,
        relationshipType: relationshipType as never,
      });
      return { entityType: "RELATIONSHIP" as const, entityId: relationship.id };
    }
    default:
      throw new Error(`Suggestion type ${suggestion.suggestionType} has no automatic entity to create.`);
  }
}

/**
 * The single dispatcher for every human decision on an AI suggestion (spec
 * section 19). Every action resolves the review and is audited; only
 * APPROVE/EDIT_APPROVE/MERGE/ATTACH_* actually create or attach data —
 * REJECT/KEEP_HYPOTHESIS(no-approve)/MARK_RESEARCH/DEFER never do more than
 * record the decision.
 */
export async function resolveSuggestion(params: ResolveSuggestionParams) {
  const suggestion = await prisma.strategySuggestion.findUniqueOrThrow({ where: { id: params.suggestionId } });

  let resultingEntityType: string | null = null;
  let resultingEntityId: string | null = null;
  let newStatus: "APPROVED" | "REJECTED" | "DRAFT" | "UNDER_REVIEW" | "DISPUTED" = "UNDER_REVIEW";

  switch (params.action) {
    case "APPROVE": {
      const created = await applySuggestionAsEntity(suggestion, params, true);
      resultingEntityType = created.entityType;
      resultingEntityId = created.entityId;
      newStatus = "APPROVED";
      break;
    }
    case "EDIT_APPROVE": {
      const created = await applySuggestionAsEntity(suggestion, params, true);
      resultingEntityType = created.entityType;
      resultingEntityId = created.entityId;
      newStatus = "APPROVED";
      break;
    }
    case "KEEP_HYPOTHESIS": {
      const created = await applySuggestionAsEntity(suggestion, params, false);
      resultingEntityType = created.entityType;
      resultingEntityId = created.entityId;
      newStatus = "DRAFT";
      break;
    }
    case "MERGE": {
      if (suggestion.suggestionType !== "COHORT" || !suggestion.duplicateOfEntityId) {
        throw new Error("Merge is only available for a cohort suggestion with a detected duplicate.");
      }
      const fields = suggestion.proposedFields as Record<string, unknown>;
      const draft = await createCohort({
        clientId: suggestion.clientId,
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        input: { name: asStr(fields, "name") ?? suggestion.title },
      });
      await mergeCohorts({
        primaryCohortId: suggestion.duplicateOfEntityId,
        duplicateCohortId: draft.id,
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
      });
      resultingEntityType = "COHORT";
      resultingEntityId = suggestion.duplicateOfEntityId;
      newStatus = "APPROVED";
      break;
    }
    case "ATTACH_COHORT": {
      const cohortId = params.targetCohortId;
      if (!cohortId) throw new Error("A target cohort is required to attach this suggestion.");
      const ref = await addCohortSourceReference({
        cohortId,
        organizationId: params.organizationId,
        linkedById: params.actorUserId,
        relationshipType: "SUPPORTS",
        note: `From AI suggestion: ${suggestion.title}`,
      });
      resultingEntityType = "COHORT_SOURCE_REFERENCE";
      resultingEntityId = ref.id;
      newStatus = "APPROVED";
      break;
    }
    case "ATTACH_EVIDENCE": {
      const targetEntityType = params.targetEntityType as never;
      const targetEntityId = params.targetEntityId;
      if (!targetEntityType || !targetEntityId) throw new Error("A target entity is required to attach evidence.");
      const fields = suggestion.proposedFields as Record<string, unknown>;
      const link = await addEvidenceLink({
        clientId: suggestion.clientId,
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        targetEntityType,
        targetEntityId,
        beliefMapId: targetEntityType === "BELIEF" ? targetEntityId : undefined,
        input: {
          description: asStr(fields, "description") ?? suggestion.title,
          evidenceStrength: (asStr(fields, "evidenceStrength") as never) ?? "WEAK",
        },
      });
      resultingEntityType = "EVIDENCE";
      resultingEntityId = link.id;
      newStatus = "APPROVED";
      break;
    }
    case "REJECT":
      newStatus = "REJECTED";
      break;
    case "MARK_RESEARCH":
    case "DEFER":
      newStatus = "UNDER_REVIEW";
      break;
    default:
      throw new Error(`Unhandled suggestion action: ${params.action}`);
  }

  await prisma.$transaction([
    prisma.strategySuggestion.update({ where: { id: suggestion.id }, data: { status: newStatus } }),
    prisma.strategySuggestionReview.update({
      where: { strategySuggestionId: suggestion.id },
      data: {
        status: "RESOLVED",
        action: params.action,
        resultingEntityType: resultingEntityType as never,
        resultingEntityId,
        reviewerId: params.actorUserId,
        reviewedAt: new Date(),
        reviewNotes: params.resolutionNote ?? null,
      },
    }),
  ]);

  await logAudit({
    organizationId: params.organizationId,
    clientId: suggestion.clientId,
    actorUserId: params.actorUserId,
    action: params.action === "REJECT" ? "REJECT" : params.action === "APPROVE" || params.action === "EDIT_APPROVE" ? "APPROVE" : "UPDATE",
    entityType: "StrategySuggestion",
    entityId: suggestion.id,
    metadata: { action: params.action, resultingEntityType, resultingEntityId },
  });

  return { resultingEntityType, resultingEntityId };
}

/** Bulk-approve only high-confidence, non-conflicting, non-duplicate suggestions; everything else is skipped, never forced. */
export async function bulkApproveSuggestions(params: { clientId: string; organizationId: string; actorUserId: string; suggestionIds: string[] }) {
  const suggestions = await prisma.strategySuggestion.findMany({
    where: { id: { in: params.suggestionIds }, clientId: params.clientId, status: "AI_SUGGESTED" },
  });

  let approved = 0;
  let skipped = 0;

  for (const suggestion of suggestions) {
    const possibleConflicts = Array.isArray(suggestion.possibleConflicts) ? suggestion.possibleConflicts : [];
    const eligible = isBulkApprovable({
      confidence: suggestion.confidence,
      isDuplicateCandidate: suggestion.isDuplicateCandidate,
      possibleConflictsCount: possibleConflicts.length,
      suggestionType: suggestion.suggestionType,
    });
    if (!eligible) {
      skipped += 1;
      continue;
    }
    await resolveSuggestion({
      suggestionId: suggestion.id,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: "APPROVE",
    });
    approved += 1;
  }

  return { approved, skipped };
}

import "server-only";

import type { ClientBrainFieldKey, ClientBrainSectionKey } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { computeScriptReadiness, type ReadinessFacts, type ScriptReadinessResult } from "@/server/domain/script-readiness";

async function hasApprovedBrainItem(
  clientId: string,
  sectionKey: ClientBrainSectionKey,
  fieldKey: ClientBrainFieldKey,
): Promise<boolean> {
  const count = await prisma.clientBrainItem.count({ where: { clientId, sectionKey, fieldKey, status: "ACTIVE" } });
  return count > 0;
}

/**
 * Gathers the minimum-readiness facts (spec section 17) from approved data
 * only — never from drafts or AI suggestions — and runs them through the
 * pure readiness rules. Used by the Guided Client Brain overview and the
 * Next Best Action engine.
 */
export async function getScriptReadiness(clientId: string): Promise<ScriptReadinessResult> {
  const [
    hasWhatTheySell,
    approvedCohortCount,
    approvedSituationWithProblemCount,
    approvedCurrentBeliefCount,
    approvedBetterBeliefCount,
    hasLanguage,
    hasVoiceTone,
    approvedContentObjectiveCount,
    approvedOfferWithPromiseCount,
    approvedOfferWithCtaCount,
    approvedUsableProofCount,
    nonPerformanceOfferCount,
    openClaimConflictCount,
  ] = await Promise.all([
    hasApprovedBrainItem(clientId, "BUSINESS", "PRODUCTS_SERVICES"),
    prisma.cohort.count({ where: { clientId, approvalStatus: "APPROVED" } }),
    prisma.commercialSituation.count({ where: { clientId, approvalStatus: "APPROVED", activeProblem: { not: null } } }),
    prisma.beliefMap.count({ where: { clientId, approvalStatus: "APPROVED" } }),
    prisma.beliefMap.count({ where: { clientId, approvalStatus: "APPROVED", betterBeliefStatement: { not: null } } }),
    hasApprovedBrainItem(clientId, "VOICE", "LANGUAGE"),
    hasApprovedBrainItem(clientId, "VOICE", "TONE"),
    prisma.scriptIntelligenceField.count({ where: { clientId, fieldKey: "content_objective", approvalStatus: "APPROVED" } }),
    prisma.offer.count({ where: { clientId, approvalStatus: "APPROVED", corePromise: { not: null } } }),
    prisma.offer.count({ where: { clientId, approvalStatus: "APPROVED", ctaRoute: { not: null } } }),
    prisma.proofItem.count({
      where: { clientId, approvalStatus: "APPROVED", needsReview: false, publicUseStatus: { in: ["PUBLIC", "PUBLIC_ANONYMOUS"] } },
    }),
    prisma.offer.count({
      where: { clientId, approvalStatus: "APPROVED", pricePresentation: { in: ["NOT_SELLING_YET", "DO_NOT_MENTION_PRICE"] } },
    }),
    prisma.conflict.count({
      where: { clientId, status: "OPEN", clientBrainItem: { sectionKey: { in: ["PROHIBITED_CLAIMS", "OFFERS", "PROOF"] } } },
    }),
  ]);

  const facts: ReadinessFacts = {
    hasWhatTheySell,
    hasApprovedAudience: approvedCohortCount > 0,
    hasSituationOrProblem: approvedSituationWithProblemCount > 0,
    hasCurrentBelief: approvedCurrentBeliefCount > 0,
    hasBetterBelief: approvedBetterBeliefCount > 0,
    hasLanguage,
    hasVoice: hasVoiceTone,
    hasContentObjective: approvedContentObjectiveCount > 0,
    hasApprovedOffer: approvedOfferWithPromiseCount > 0,
    hasApprovedCta: approvedOfferWithCtaCount > 0,
    hasSafeApprovedClaim: approvedOfferWithPromiseCount > 0,
    hasRelevantProofOrNonPerformancePositioning: approvedUsableProofCount > 0 || nonPerformanceOfferCount > 0,
    hasUnresolvedCriticalClaimConflict: openClaimConflictCount > 0,
  };

  return computeScriptReadiness(facts);
}

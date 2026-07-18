import "server-only";

import type { ClientBrainFieldKey, ClientBrainSectionKey, ContentObjective, ReelFormat, ReelPlatform } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { ScriptGenerationContextSchema, type ScriptGenerationContext, type ScriptContextSourceReference } from "@/server/domain/script-generation-context";
import { computeScriptReadiness, type ReadinessFacts } from "@/server/domain/script-readiness";

export type CompileScriptContextInput = {
  clientId: string;
  cohortId: string;
  contentObjective: ContentObjective;
  platform: ReelPlatform;
  offerId?: string | null;
  beliefMapId?: string | null;
  commercialSituationId?: string | null;
  ctaRoute?: string | null;
  format?: ReelFormat | null;
  durationSeconds?: number | null;
  version?: number;
};

async function approvedBrainValue(clientId: string, sectionKey: ClientBrainSectionKey, fieldKey: ClientBrainFieldKey) {
  return prisma.clientBrainItem.findFirst({
    where: { clientId, sectionKey, fieldKey, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });
}

async function approvedBrainValues(clientId: string, sectionKey: ClientBrainSectionKey, fieldKey: ClientBrainFieldKey) {
  return prisma.clientBrainItem.findMany({ where: { clientId, sectionKey, fieldKey, status: "ACTIVE" } });
}

async function approvedScriptIntelligenceField(clientId: string, fieldKey: string) {
  return prisma.scriptIntelligenceField.findFirst({ where: { clientId, fieldKey, approvalStatus: "APPROVED" } });
}

function toSourceRef(entityType: string, entityId: string, field: string | null, approvalStatus: string, approvedAt: Date | null): ScriptContextSourceReference {
  return { entityType, entityId, field, approvalStatus, approvedAt: approvedAt ? approvedAt.toISOString() : null };
}

/**
 * Compiles the ScriptGenerationContext for one Reel request: loads only
 * authorized, approved data for this client (spec section 24), excludes any
 * field that has no Script Impact (every field read here maps to a
 * guided-question-catalog destination, which is itself Script-Impact-gated —
 * see script-impact.ts), preserves a source reference for every fact, and
 * surfaces missing-critical-input warnings instead of fabricating gaps.
 * Never returns raw source text — only normalized, reviewed values.
 */
export async function compileScriptContext(input: CompileScriptContextInput): Promise<{ context: ScriptGenerationContext; warnings: string[] }> {
  const sourceReferences: ScriptContextSourceReference[] = [];
  const warnings: string[] = [];

  const cohort = await prisma.cohort.findFirstOrThrow({ where: { id: input.cohortId, clientId: input.clientId } });
  if (cohort.approvalStatus !== "APPROVED") warnings.push("The selected audience is not yet approved.");
  else sourceReferences.push(toSourceRef("Cohort", cohort.id, "name", cohort.approvalStatus, cohort.updatedAt));

  const commercialSituation = input.commercialSituationId
    ? await prisma.commercialSituation.findFirst({ where: { id: input.commercialSituationId, clientId: input.clientId } })
    : await prisma.commercialSituation.findFirst({ where: { clientId: input.clientId, cohortId: cohort.id, approvalStatus: "APPROVED" }, orderBy: { updatedAt: "desc" } });
  if (commercialSituation?.approvalStatus === "APPROVED") {
    sourceReferences.push(toSourceRef("CommercialSituation", commercialSituation.id, "activeProblem", commercialSituation.approvalStatus, commercialSituation.updatedAt));
  }

  const beliefMap = input.beliefMapId
    ? await prisma.beliefMap.findFirst({ where: { id: input.beliefMapId, clientId: input.clientId } })
    : await prisma.beliefMap.findFirst({ where: { clientId: input.clientId, cohortId: cohort.id, approvalStatus: "APPROVED" }, orderBy: { updatedAt: "desc" } });
  if (beliefMap?.approvalStatus === "APPROVED") {
    sourceReferences.push(toSourceRef("BeliefMap", beliefMap.id, "currentBeliefStatement", beliefMap.approvalStatus, beliefMap.updatedAt));
  }

  // An offer is only auto-inferred for a commercial objective — never attached to educational/awareness content the user didn't ask to sell in.
  const offer = input.offerId
    ? await prisma.offer.findFirst({ where: { id: input.offerId, clientId: input.clientId, approvalStatus: "APPROVED" } })
    : input.contentObjective === "OFFER_PROMOTION"
      ? await prisma.offer.findFirst({ where: { clientId: input.clientId, approvalStatus: "APPROVED" }, orderBy: { updatedAt: "desc" } })
      : null;
  if (offer) sourceReferences.push(toSourceRef("Offer", offer.id, "corePromise", offer.approvalStatus, offer.updatedAt));
  else if (input.offerId) warnings.push("The selected offer is not yet approved and was excluded from this context.");

  const proofItems = offer
    ? await prisma.proofItem.findMany({
        where: { clientId: input.clientId, offerId: offer.id, approvalStatus: "APPROVED", needsReview: false, publicUseStatus: { in: ["PUBLIC", "PUBLIC_ANONYMOUS"] } },
      })
    : [];
  for (const proof of proofItems) sourceReferences.push(toSourceRef("ProofItem", proof.id, "whatHappened", proof.approvalStatus, proof.updatedAt));

  const [whatTheySell, businessModel, category, language, dialect, tones, vocabulary, prohibitedPhrases, neverClaim, legalRestrictions] = await Promise.all([
    approvedBrainValue(input.clientId, "BUSINESS", "PRODUCTS_SERVICES"),
    approvedBrainValue(input.clientId, "BUSINESS", "BUSINESS_MODEL"),
    approvedBrainValue(input.clientId, "POSITIONING", "CATEGORY"),
    approvedBrainValue(input.clientId, "VOICE", "LANGUAGE"),
    approvedBrainValue(input.clientId, "VOICE", "DIALECT"),
    approvedBrainValues(input.clientId, "VOICE", "TONE"),
    approvedBrainValues(input.clientId, "VOICE", "VOCABULARY"),
    approvedBrainValues(input.clientId, "VOICE", "PROHIBITED_PHRASES"),
    approvedBrainValues(input.clientId, "PROHIBITED_CLAIMS", "CLAIM"),
    approvedBrainValues(input.clientId, "CONSTRAINTS", "LEGAL"),
  ]);

  const [technicality, goodExample, badExample, languageMixing, avoidTopicsField, testimonialsPublicField, requiresApprovalField, expiredClaimsField, speaker, editingLevel, cannotShow] =
    await Promise.all([
      approvedScriptIntelligenceField(input.clientId, "voice_technicality"),
      approvedScriptIntelligenceField(input.clientId, "voice_good_example"),
      approvedScriptIntelligenceField(input.clientId, "voice_bad_example"),
      approvedScriptIntelligenceField(input.clientId, "voice_language_mixing"),
      approvedScriptIntelligenceField(input.clientId, "safety_avoid_topics"),
      approvedScriptIntelligenceField(input.clientId, "safety_testimonials_public"),
      approvedScriptIntelligenceField(input.clientId, "safety_requires_approval"),
      approvedScriptIntelligenceField(input.clientId, "safety_expired_claims"),
      approvedBrainValue(input.clientId, "PRODUCTION", "TEAM"),
      approvedBrainValue(input.clientId, "PRODUCTION", "EDITING_CAPACITY"),
      approvedBrainValues(input.clientId, "PRODUCTION", "PRODUCTION_CONSTRAINTS"),
    ]);

  for (const [field, item] of [
    ["PRODUCTS_SERVICES", whatTheySell],
    ["BUSINESS_MODEL", businessModel],
    ["CATEGORY", category],
    ["LANGUAGE", language],
    ["DIALECT", dialect],
  ] as const) {
    if (item) sourceReferences.push(toSourceRef("ClientBrainItem", item.id, field, item.status, item.updatedAt));
  }
  for (const item of [...tones, ...vocabulary, ...prohibitedPhrases, ...neverClaim, ...legalRestrictions, ...cannotShow]) {
    sourceReferences.push(toSourceRef("ClientBrainItem", item.id, item.fieldKey, item.status, item.updatedAt));
  }
  for (const item of [speaker, editingLevel]) {
    if (item) sourceReferences.push(toSourceRef("ClientBrainItem", item.id, item.fieldKey, item.status, item.updatedAt));
  }
  for (const field of [technicality, goodExample, badExample, languageMixing, avoidTopicsField, testimonialsPublicField, requiresApprovalField, expiredClaimsField]) {
    if (field) sourceReferences.push(toSourceRef("ScriptIntelligenceField", field.id, field.fieldKey, field.approvalStatus, field.updatedAt));
  }

  const openConflictSections = await prisma.conflict.findMany({
    where: { clientId: input.clientId, status: "OPEN", clientBrainItem: { sectionKey: { in: ["BUSINESS", "VOICE", "OFFERS", "PROOF", "BELIEFS", "PROHIBITED_CLAIMS"] } } },
    select: { clientBrainItem: { select: { sectionKey: true } } },
  });
  for (const conflictSection of new Set(openConflictSections.map((c) => c.clientBrainItem.sectionKey))) {
    warnings.push(`There's an unresolved conflict in ${conflictSection} — resolve it before relying on this context.`);
  }

  const facts: ReadinessFacts = {
    hasWhatTheySell: Boolean(whatTheySell),
    hasApprovedAudience: cohort.approvalStatus === "APPROVED",
    hasSituationOrProblem: Boolean(commercialSituation?.activeProblem && commercialSituation.approvalStatus === "APPROVED"),
    hasCurrentBelief: Boolean(beliefMap && beliefMap.approvalStatus === "APPROVED"),
    hasBetterBelief: Boolean(beliefMap?.betterBeliefStatement && beliefMap.approvalStatus === "APPROVED"),
    hasLanguage: Boolean(language),
    hasVoice: tones.length > 0,
    hasContentObjective: true,
    hasApprovedOffer: Boolean(offer?.corePromise),
    hasApprovedCta: Boolean(offer?.ctaRoute || input.ctaRoute),
    hasSafeApprovedClaim: Boolean(offer?.corePromise),
    hasRelevantProofOrNonPerformancePositioning: proofItems.length > 0 || offer?.pricePresentation === "NOT_SELLING_YET" || offer?.pricePresentation === "DO_NOT_MENTION_PRICE",
    hasUnresolvedCriticalClaimConflict: openConflictSections.length > 0,
  };
  const readiness = computeScriptReadiness(facts);
  const missingCriticalInputWarnings = readiness.gaps.map((gap) => gap.message);

  const context: ScriptGenerationContext = {
    meta: {
      contextId: `ctx_${cohort.id}_${Date.now()}`,
      clientId: input.clientId,
      cohortId: cohort.id,
      generatedAt: new Date().toISOString(),
      version: input.version ?? 1,
    },
    request: {
      cohortId: cohort.id,
      contentObjective: input.contentObjective,
      platform: input.platform,
      offerId: offer?.id ?? null,
      beliefMapId: beliefMap?.id ?? null,
      commercialSituationId: commercialSituation?.id ?? null,
      ctaRoute: input.ctaRoute ?? null,
      format: input.format ?? null,
      durationSeconds: input.durationSeconds ?? null,
    },
    business: {
      whatTheySell: whatTheySell?.valueText ?? null,
      businessModel: businessModel?.valueText ?? null,
      category: category?.valueText ?? null,
    },
    audience: {
      cohortName: cohort.name,
      role: cohort.role,
      activeProblem: commercialSituation?.activeProblem ?? null,
      triggerDescription: commercialSituation?.triggerDescription ?? null,
      currentWorkflow: cohort.currentWorkflow,
      desiredOutcome: cohort.desiredOutcome,
      decisionRisk: cohort.decisionRisk,
      platformPresence: cohort.platformPresence,
    },
    beliefChain: beliefMap
      ? {
          observedSituation: beliefMap.observedSituation,
          currentInterpretation: beliefMap.currentInterpretation,
          currentBeliefStatement: beliefMap.currentBeliefStatement,
          behaviorCaused: beliefMap.behaviorCaused,
          commercialConsequence: beliefMap.commercialConsequence,
          betterBeliefStatement: beliefMap.betterBeliefStatement,
          betterCommercialDecision: beliefMap.betterCommercialDecision,
        }
      : null,
    offer: offer
      ? {
          name: offer.name,
          forWhom: offer.forWhom,
          corePromise: offer.corePromise,
          intendedOutcome: offer.intendedOutcome,
          mechanism: offer.mechanism,
          deliverables: offer.deliverables,
          pricePresentation: offer.pricePresentation,
          priceText: offer.priceText,
          guarantee: offer.guarantee,
          ctaRoute: offer.ctaRoute,
        }
      : null,
    proof: proofItems.map((proof) => ({
      proofType: proof.proofType,
      whatHappened: proof.whatHappened,
      whoForWhom: proof.whoForWhom,
      startingPoint: proof.startingPoint,
      whatChanged: proof.whatChanged,
      overPeriod: proof.overPeriod,
      limitations: proof.limitations,
      evidenceStrength: proof.evidenceStrength,
      publicUseStatus: proof.publicUseStatus,
    })),
    voice: {
      language: language?.valueText ?? null,
      dialect: dialect?.valueText ?? null,
      tones: tones.map((t) => t.valueText).filter((v): v is string => Boolean(v)),
      vocabulary: vocabulary.map((t) => t.valueText).filter((v): v is string => Boolean(v)),
      prohibitedPhrases: prohibitedPhrases.map((t) => t.valueText).filter((v): v is string => Boolean(v)),
      technicality: technicality?.normalizedValue ?? null,
      goodExample: goodExample?.normalizedValue ?? null,
      badExample: badExample?.normalizedValue ?? null,
      languageMixing: languageMixing?.normalizedValue ?? null,
    },
    execution: {
      platform: input.platform,
      format: input.format ?? null,
      durationSeconds: input.durationSeconds ?? null,
      speaker: speaker?.valueText ?? null,
      editingLevel: editingLevel?.valueText ?? null,
      cannotShow: cannotShow.map((t) => t.valueText).filter((v): v is string => Boolean(v)),
    },
    safety: {
      neverClaim: neverClaim.map((t) => t.valueText).filter((v): v is string => Boolean(v)),
      legalRestrictions: legalRestrictions.map((t) => t.valueText).filter((v): v is string => Boolean(v)),
      avoidTopics: avoidTopicsField?.normalizedValue ? avoidTopicsField.normalizedValue.split("\n").filter(Boolean) : [],
      testimonialsPublic: testimonialsPublicField ? testimonialsPublicField.normalizedValue === "true" : null,
      requiresApproval: requiresApprovalField ? requiresApprovalField.normalizedValue === "true" : null,
      expiredClaims: expiredClaimsField?.normalizedValue ? expiredClaimsField.normalizedValue.split("\n").filter(Boolean) : [],
    },
    grounding: {
      sourceReferences,
      missingCriticalInputWarnings,
    },
  };

  ScriptGenerationContextSchema.parse(context);
  return { context, warnings: [...warnings, ...missingCriticalInputWarnings] };
}

import { z } from "zod";
import { ContentObjective, ReelPlatform, ReelFormat } from "@prisma/client";

/**
 * ScriptGenerationContext (spec section 24) — the ONLY thing the AI
 * generation layer is ever allowed to see. It is compiled by
 * scriptContextCompiler from authorized, approved data; the AI never
 * receives raw source content, unapproved drafts, or fields with no Script
 * Impact. Every object is `.strict()` so an unexpected field fails loudly
 * instead of silently leaking something ungoverned into a prompt.
 */

export const ScriptContextSourceReferenceSchema = z
  .object({
    entityType: z.string(),
    entityId: z.string(),
    field: z.string().nullable(),
    approvalStatus: z.string(),
    approvedAt: z.string().nullable(),
  })
  .strict();

export const ScriptGenerationContextSchema = z
  .object({
    meta: z
      .object({
        contextId: z.string(),
        clientId: z.string(),
        cohortId: z.string(),
        generatedAt: z.string(),
        version: z.number().int().positive(),
      })
      .strict(),

    request: z
      .object({
        cohortId: z.string(),
        contentObjective: z.nativeEnum(ContentObjective),
        platform: z.nativeEnum(ReelPlatform),
        offerId: z.string().nullable(),
        beliefMapId: z.string().nullable(),
        commercialSituationId: z.string().nullable(),
        ctaRoute: z.string().nullable(),
        format: z.nativeEnum(ReelFormat).nullable(),
        durationSeconds: z.number().int().positive().nullable(),
      })
      .strict(),

    business: z
      .object({
        whatTheySell: z.string().nullable(),
        businessModel: z.string().nullable(),
        category: z.string().nullable(),
      })
      .strict(),

    audience: z
      .object({
        cohortName: z.string(),
        role: z.string().nullable(),
        activeProblem: z.string().nullable(),
        triggerDescription: z.string().nullable(),
        currentWorkflow: z.string().nullable(),
        desiredOutcome: z.string().nullable(),
        decisionRisk: z.string().nullable(),
        platformPresence: z.array(z.string()),
      })
      .strict(),

    beliefChain: z
      .object({
        observedSituation: z.string().nullable(),
        currentInterpretation: z.string().nullable(),
        currentBeliefStatement: z.string(),
        behaviorCaused: z.string().nullable(),
        commercialConsequence: z.string().nullable(),
        betterBeliefStatement: z.string().nullable(),
        betterCommercialDecision: z.string().nullable(),
      })
      .strict()
      .nullable(),

    offer: z
      .object({
        name: z.string(),
        forWhom: z.string().nullable(),
        corePromise: z.string().nullable(),
        intendedOutcome: z.string().nullable(),
        mechanism: z.string().nullable(),
        deliverables: z.array(z.string()),
        pricePresentation: z.string(),
        priceText: z.string().nullable(),
        guarantee: z.string().nullable(),
        ctaRoute: z.string().nullable(),
      })
      .strict()
      .nullable(),

    proof: z.array(
      z
        .object({
          proofType: z.string(),
          whatHappened: z.string().nullable(),
          whoForWhom: z.string().nullable(),
          startingPoint: z.string().nullable(),
          whatChanged: z.string().nullable(),
          overPeriod: z.string().nullable(),
          limitations: z.array(z.string()),
          evidenceStrength: z.string(),
          publicUseStatus: z.string(),
        })
        .strict(),
    ),

    voice: z
      .object({
        language: z.string().nullable(),
        dialect: z.string().nullable(),
        tones: z.array(z.string()),
        vocabulary: z.array(z.string()),
        prohibitedPhrases: z.array(z.string()),
        technicality: z.string().nullable(),
        goodExample: z.string().nullable(),
        badExample: z.string().nullable(),
        languageMixing: z.string().nullable(),
      })
      .strict(),

    execution: z
      .object({
        platform: z.nativeEnum(ReelPlatform),
        format: z.nativeEnum(ReelFormat).nullable(),
        durationSeconds: z.number().int().positive().nullable(),
        speaker: z.string().nullable(),
        editingLevel: z.string().nullable(),
        cannotShow: z.array(z.string()),
      })
      .strict(),

    safety: z
      .object({
        neverClaim: z.array(z.string()),
        legalRestrictions: z.array(z.string()),
        avoidTopics: z.array(z.string()),
        testimonialsPublic: z.boolean().nullable(),
        requiresApproval: z.boolean().nullable(),
        expiredClaims: z.array(z.string()),
      })
      .strict(),

    grounding: z
      .object({
        sourceReferences: z.array(ScriptContextSourceReferenceSchema),
        missingCriticalInputWarnings: z.array(z.string()),
      })
      .strict(),
  })
  .strict();

export type ScriptGenerationContext = z.infer<typeof ScriptGenerationContextSchema>;
export type ScriptContextSourceReference = z.infer<typeof ScriptContextSourceReferenceSchema>;

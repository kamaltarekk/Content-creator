import { z } from "zod";
import {
  ReelPlatform,
  ContentObjective,
  ReelFormat,
  HookType,
  ScriptSegmentType,
  PortfolioRole,
  CtaType,
  PromotionalIntensity,
  ReelClaimStatus,
  ProductionEditingLevel,
  AuditGateStatus,
} from "@prisma/client";

/**
 * ReelScriptPackage (spec section 28) — the complete, structured output of
 * one Reel generation. Strict Zod on every level: the AI's raw output is
 * validated against this before anything is shown to a user or persisted.
 * Exactly 3 hookOptions are required (never more, never fewer) and audits
 * cover the 6 package-level gates; comprehensive gate detail (duration, CTA
 * fit) lives in reelScriptValidationService's richer validation record.
 */

export const ReelSourceReferenceSchema = z
  .object({
    entityType: z.string(),
    entityId: z.string(),
    field: z.string().nullable(),
  })
  .strict();

export const HookOptionSchema = z
  .object({
    hookType: z.nativeEnum(HookType),
    text: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export const ScriptSegmentSchema = z
  .object({
    type: z.nativeEnum(ScriptSegmentType),
    text: z.string().min(1),
    visualDirection: z.string().nullable(),
    estimatedSeconds: z.number().positive(),
  })
  .strict();

export const AuditResultSchema = z
  .object({
    status: z.nativeEnum(AuditGateStatus),
    note: z.string(),
  })
  .strict();

export const OptionalAlternativeSchema = z
  .object({
    type: z.enum(["HOOK", "ANGLE", "CTA"]),
    label: z.string(),
    description: z.string(),
  })
  .strict();

export const ReelScriptPackageSchema = z
  .object({
    meta: z
      .object({
        packageId: z.string(),
        clientId: z.string(),
        cohortId: z.string(),
        contextSnapshotId: z.string(),
        generatedAt: z.string(),
        contentObjective: z.nativeEnum(ContentObjective),
        platform: z.nativeEnum(ReelPlatform),
      })
      .strict(),

    strategy: z
      .object({
        funnelStage: z.string(),
        cognitiveObjective: z.string(),
        coreTakeaway: z.string().min(1),
        beliefShiftFrom: z.string().nullable(),
        beliefShiftTo: z.string().nullable(),
        rationale: z.string().min(1).max(600),
      })
      .strict(),

    hookOptions: z.array(HookOptionSchema).length(3),
    selectedHookIndex: z.number().int().min(0).max(2),

    script: z
      .object({
        segments: z.array(ScriptSegmentSchema).min(1),
        fullText: z.string().min(1),
        estimatedDurationSeconds: z.number().positive(),
        wordCount: z.number().int().positive(),
      })
      .strict(),

    production: z
      .object({
        format: z.nativeEnum(ReelFormat),
        speaker: z.string().nullable(),
        editingLevel: z.nativeEnum(ProductionEditingLevel),
        visualPlan: z.array(z.string()),
        resources: z.array(z.string()),
      })
      .strict(),

    commercial: z
      .object({
        portfolioRole: z.nativeEnum(PortfolioRole),
        ctaType: z.nativeEnum(CtaType),
        ctaText: z.string().nullable(),
        promotionalIntensity: z.nativeEnum(PromotionalIntensity),
        claimStatus: z.nativeEnum(ReelClaimStatus),
      })
      .strict(),

    audits: z
      .object({
        strategicGrounding: AuditResultSchema,
        voiceAlignment: AuditResultSchema,
        claimSafety: AuditResultSchema,
        comprehension: AuditResultSchema,
        platformFit: AuditResultSchema,
        productionFeasibility: AuditResultSchema,
      })
      .strict(),

    sources: z.array(ReelSourceReferenceSchema),
    warnings: z.array(z.string()),
    optionalAlternatives: z.array(OptionalAlternativeSchema),
  })
  .strict();

export type ReelScriptPackage = z.infer<typeof ReelScriptPackageSchema>;
export type HookOption = z.infer<typeof HookOptionSchema>;
export type ScriptSegment = z.infer<typeof ScriptSegmentSchema>;
export type AuditResult = z.infer<typeof AuditResultSchema>;

/**
 * What the AI generation layer actually produces: every creative part of the
 * package, minus what the service fills in deterministically (meta,
 * sources — copied from the compiled context's grounding — and audits, which
 * reelScriptValidationService computes independently of anything the model
 * claims about itself).
 */
export const ReelScriptDraftSchema = z
  .object({
    strategy: z
      .object({
        funnelStage: z.string(),
        cognitiveObjective: z.string(),
        coreTakeaway: z.string().min(1),
        beliefShiftFrom: z.string().nullable(),
        beliefShiftTo: z.string().nullable(),
        rationale: z.string().min(1).max(600),
      })
      .strict(),
    hookOptions: z.array(HookOptionSchema).length(3),
    selectedHookIndex: z.number().int().min(0).max(2),
    script: z
      .object({
        segments: z.array(ScriptSegmentSchema).min(1),
        fullText: z.string().min(1),
        estimatedDurationSeconds: z.number().positive(),
        wordCount: z.number().int().positive(),
      })
      .strict(),
    production: z
      .object({
        format: z.nativeEnum(ReelFormat),
        speaker: z.string().nullable(),
        editingLevel: z.nativeEnum(ProductionEditingLevel),
        visualPlan: z.array(z.string()),
        resources: z.array(z.string()),
      })
      .strict(),
    commercial: z
      .object({
        portfolioRole: z.nativeEnum(PortfolioRole),
        ctaType: z.nativeEnum(CtaType),
        ctaText: z.string().nullable(),
        promotionalIntensity: z.nativeEnum(PromotionalIntensity),
        claimStatus: z.nativeEnum(ReelClaimStatus),
      })
      .strict(),
    optionalAlternatives: z.array(OptionalAlternativeSchema),
  })
  .strict();

export type ReelScriptDraft = z.infer<typeof ReelScriptDraftSchema>;

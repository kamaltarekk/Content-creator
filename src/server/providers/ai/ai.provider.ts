import { z } from "zod";
import { ClientBrainFieldKey, ClientBrainSectionKey, InformationType, type BlockType, type SourceCategory } from "@prisma/client";

import { SECTION_FIELD_MAP } from "@/server/domain/brain-schema";
import type { StrategySuggestionResult, SuggestStrategyInput } from "@/server/domain/strategy-suggestion";
import type { GuidedAnswerSuggestionResult, SuggestGuidedAnswerInput } from "@/server/domain/guided-answer-suggestion";
import type { ReelScriptDraft } from "@/server/domain/reel-script-package";
import type { ScriptGenerationContext } from "@/server/domain/script-generation-context";

/**
 * Strict schema for one block's classification. The AIProvider returns data
 * validated against this — malformed output is rejected, never trusted.
 * `reasoning_summary` is a short, user-safe justification; we never request
 * or store private chain-of-thought.
 */
export const ClassificationSchema = z
  .object({
    information_type: z.nativeEnum(InformationType),
    proposed_destination: z.nativeEnum(ClientBrainSectionKey).nullable(),
    proposed_field: z.nativeEnum(ClientBrainFieldKey).nullable(),
    normalized_value: z.string().min(1).max(2000),
    confidence: z.number().min(0).max(1),
    detected_language: z.string().min(2).max(20),
    is_conflict_candidate: z.boolean(),
    reasoning_summary: z.string().max(400),
    suggested_tags: z.array(z.string().max(40)).max(6),
  })
  .superRefine((value, ctx) => {
    const needsDestination: InformationType[] = [
      "STRATEGIC_FACT",
      "CLIENT_PREFERENCE",
      "AUDIENCE_SIGNAL",
      "EVIDENCE",
      "HYPOTHESIS",
      "PERFORMANCE_LEARNING",
    ];

    if (needsDestination.includes(value.information_type)) {
      if (!value.proposed_destination || !value.proposed_field) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "destination and field are required for this information_type",
        });
        return;
      }
    }

    if (value.proposed_destination && value.proposed_field) {
      const allowed = SECTION_FIELD_MAP[value.proposed_destination];
      if (!allowed.includes(value.proposed_field)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `field ${value.proposed_field} does not belong to section ${value.proposed_destination}`,
        });
      }
    }
  });

export type ClassificationResult = z.infer<typeof ClassificationSchema>;

export type ClassifyBlockInput = {
  blockText: string;
  blockType: BlockType;
  locationLabel: string;
  sourceCategory: SourceCategory;
  clientContext: {
    clientName: string;
    brandType: string;
    existingBrainDigest: string;
  };
};

/**
 * Model-agnostic classification boundary. OpenAIProvider is the first
 * implementation; another provider can be dropped in without touching the
 * classification service.
 */
export interface AIProvider {
  classifyBlock(input: ClassifyBlockInput): Promise<ClassificationResult>;
  /** Module 2: proposes one strategy entity (cohort/situation/decision/belief/...) from authorized, client-scoped context only. */
  suggestStrategy(input: SuggestStrategyInput): Promise<StrategySuggestionResult>;
  /** Module 3: "Let AI suggest" for one Guided Setup question — a single grounded answer, never fabricated. */
  suggestGuidedAnswer(input: SuggestGuidedAnswerInput): Promise<GuidedAnswerSuggestionResult>;
  /** Module 3: generates a complete Reel script draft from a compiled ScriptGenerationContext — the ONLY input it ever sees. */
  generateReelScript(context: ScriptGenerationContext): Promise<ReelScriptDraft>;
}

export class AIProviderError extends Error {}

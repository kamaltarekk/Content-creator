import { z } from "zod";
import { StrategicEntityType, StrategicRelationshipType, StrategySuggestionType } from "@prisma/client";

/**
 * Shared pure contract for one AI strategy suggestion (spec section 16).
 * Imported by the AIProvider implementation, strategySuggestion.service.ts,
 * and unit tests — the AI's raw output is always validated against this
 * before anything touches the database. Never trusted, never auto-approved.
 */
export const SourceReferenceSchema = z.object({
  source_type: z.enum(["CLIENT_BRAIN_ITEM", "EXTRACTED_ITEM", "SOURCE", "AUDIENCE_SIGNAL", "MANUAL"]),
  reference_id: z.string().min(1).max(200),
  note: z.string().max(300).optional(),
});

export const PossibleConflictSchema = z.object({
  existing_entity_type: z.nativeEnum(StrategicEntityType),
  existing_entity_id: z.string().min(1),
  reason: z.string().max(400),
});

export const SuggestedRelationshipSchema = z.object({
  target_entity_type: z.nativeEnum(StrategicEntityType),
  target_entity_id: z.string().min(1),
  relationship_type: z.nativeEnum(StrategicRelationshipType),
});

export const StrategySuggestionSchema = z
  .object({
    suggestion_type: z.nativeEnum(StrategySuggestionType),
    title: z.string().min(1).max(200),
    proposed_fields: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.number(), z.null()])),
    source_references: z.array(SourceReferenceSchema).max(20),
    confidence: z.number().min(0).max(1),
    reasoning_summary: z.string().max(400),
    missing_evidence: z.array(z.string().max(200)).max(10),
    possible_conflicts: z.array(PossibleConflictSchema).max(10),
    suggested_relationships: z.array(SuggestedRelationshipSchema).max(20),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value.proposed_fields).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "proposed_fields must not be empty — a suggestion must propose something concrete.",
      });
    }
  });

export type StrategySuggestionResult = z.infer<typeof StrategySuggestionSchema>;

export type SuggestStrategyInput = {
  clientId: string;
  /** Which kind of entity the caller is asking the AI to suggest. */
  targetType: StrategySuggestionType;
  /** Authorized, client-scoped context the suggestion may draw from — never invented. */
  context: {
    clientName: string;
    brandType: string;
    existingBrainDigest: string;
    existingStrategyDigest: string;
    selectedAudienceSignals: string[];
  };
};

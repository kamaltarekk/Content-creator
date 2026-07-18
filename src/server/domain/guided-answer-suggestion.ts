import { z } from "zod";

/** A single-field AI suggestion for one Guided Setup question — never chain-of-thought, one plain-language sentence of reasoning. */
export const GuidedAnswerSuggestionSchema = z.object({
  value: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1),
  reasoningSummary: z.string().max(300),
});

export type GuidedAnswerSuggestionResult = z.infer<typeof GuidedAnswerSuggestionSchema>;

export type SuggestGuidedAnswerInput = {
  question: string;
  helperText: string | null;
  example: string | null;
  clientContext: {
    clientName: string;
    brandType: string;
    existingBrainDigest: string;
  };
};

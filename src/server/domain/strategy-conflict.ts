import type { StrategySuggestionType } from "@prisma/client";

import { diceCoefficient } from "@/server/domain/similarity";

/** Above this Dice similarity, a proposed name/statement is treated as a likely duplicate of an existing entity. */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.6;

export type SimilarEntityMatch = { id: string; similarity: number };

/** Pure fuzzy match: does a proposed name/statement resemble an existing one closely enough to be a duplicate candidate? */
export function findMostSimilar(proposed: string, existing: { id: string; value: string }[]): SimilarEntityMatch | null {
  let best: SimilarEntityMatch | null = null;
  for (const candidate of existing) {
    const similarity = diceCoefficient(proposed, candidate.value);
    if (similarity >= DUPLICATE_SIMILARITY_THRESHOLD && (!best || similarity > best.similarity)) {
      best = { id: candidate.id, similarity };
    }
  }
  return best;
}

export type BulkApprovabilityInput = {
  confidence: number;
  isDuplicateCandidate: boolean;
  possibleConflictsCount: number;
  suggestionType: StrategySuggestionType;
};

const BULK_APPROVE_CONFIDENCE_THRESHOLD = 0.75;

/**
 * Deterministic bulk-approval eligibility (spec section 19): only high-
 * confidence, non-conflicting, non-duplicate suggestions may ever be bulk-
 * approved. Conflicts and duplicate candidates always require individual
 * review — this function is the single source of truth so the UI and the
 * server action can never disagree.
 */
export function isBulkApprovable(input: BulkApprovabilityInput): boolean {
  return (
    input.confidence >= BULK_APPROVE_CONFIDENCE_THRESHOLD && !input.isDuplicateCandidate && input.possibleConflictsCount === 0
  );
}

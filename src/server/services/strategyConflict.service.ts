import "server-only";

import { prisma } from "@/server/db/prisma";
import { findMostSimilar } from "@/server/domain/strategy-conflict";

export type DuplicateCheckResult = { entityType: "COHORT" | "BELIEF"; entityId: string; similarity: number } | null;

/**
 * Deterministic duplicate detection run against the live database — separate
 * from (and in addition to) whatever the AI itself reports in
 * possible_conflicts. Only COHORT and BELIEF_MAP suggestions are checked
 * against their natural duplicate signal (name / belief statement); other
 * suggestion types have no single obvious field to fuzzy-match against yet.
 */
export async function detectSuggestionDuplicate(params: {
  clientId: string;
  suggestionType: string;
  proposedFields: Record<string, unknown>;
}): Promise<DuplicateCheckResult> {
  if (params.suggestionType === "COHORT") {
    const name = typeof params.proposedFields.name === "string" ? params.proposedFields.name : null;
    if (!name) return null;
    const cohorts = await prisma.cohort.findMany({
      where: { clientId: params.clientId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
    });
    const match = findMostSimilar(
      name,
      cohorts.map((c) => ({ id: c.id, value: c.name })),
    );
    return match ? { entityType: "COHORT", entityId: match.id, similarity: match.similarity } : null;
  }

  if (params.suggestionType === "BELIEF_MAP") {
    const statement = typeof params.proposedFields.currentBeliefStatement === "string" ? params.proposedFields.currentBeliefStatement : null;
    if (!statement) return null;
    const beliefs = await prisma.beliefMap.findMany({
      where: { clientId: params.clientId, archivedAt: null },
      select: { id: true, currentBeliefStatement: true },
    });
    const match = findMostSimilar(
      statement,
      beliefs.map((b) => ({ id: b.id, value: b.currentBeliefStatement })),
    );
    return match ? { entityType: "BELIEF", entityId: match.id, similarity: match.similarity } : null;
  }

  return null;
}

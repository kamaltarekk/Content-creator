import "server-only";

import { prisma } from "@/server/db/prisma";
import { READINESS_WEIGHTS, STRATEGY_FOLLOWUP_QUESTIONS, type ReadinessCategory } from "@/server/domain/strategy-schema";

export type ReadinessCategoryStat = { covered: number; total: number };
export type ReadinessStats = Record<ReadinessCategory, ReadinessCategoryStat>;

export type ReadinessCategoryResult = {
  category: ReadinessCategory;
  weight: number;
  coverage: number; // 0..1
  weightedContribution: number; // coverage * weight
  covered: number;
  total: number;
};

export type StrategyReadinessResult = {
  /** Labeled "Strategy Setup Readiness" everywhere in the UI — never a prediction of business success. */
  overall: number;
  categories: ReadinessCategoryResult[];
  followUpQuestions: { category: ReadinessCategory; question: string }[];
};

const WEAK_THRESHOLD = 0.6;

/**
 * Pure readiness calculation (mirrors computeCompleteness). Each category's
 * coverage is the fraction of cohorts (the unit of analysis) for which that
 * category is populated — e.g. "beliefs" coverage is the fraction of cohorts
 * that have at least one developed belief map.
 */
export function computeStrategyReadiness(stats: ReadinessStats): StrategyReadinessResult {
  const categories: ReadinessCategoryResult[] = (Object.keys(READINESS_WEIGHTS) as ReadinessCategory[]).map(
    (category) => {
      const stat = stats[category];
      const coverage = stat.total === 0 ? 0 : stat.covered / stat.total;
      const weight = READINESS_WEIGHTS[category];
      return {
        category,
        weight,
        coverage,
        weightedContribution: coverage * weight,
        covered: stat.covered,
        total: stat.total,
      };
    },
  );

  const overall = Math.round(categories.reduce((sum, c) => sum + c.weightedContribution, 0));

  const followUpQuestions = categories
    .filter((c) => c.coverage < WEAK_THRESHOLD)
    .map((c) => ({ category: c.category, question: STRATEGY_FOLLOWUP_QUESTIONS[c.category] }));

  return { overall, categories, followUpQuestions };
}

/**
 * Aggregates live strategy data for a client into the stats the pure
 * calculator needs. Cohorts are the unit of analysis: a client with zero
 * cohorts scores 0 everywhere, since none of the reasoning chain exists yet.
 */
export async function getStrategyReadinessForClient(clientId: string): Promise<StrategyReadinessResult> {
  const cohorts = await prisma.cohort.findMany({
    where: { clientId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      definition: true,
      commercialContext: true,
      currentBelief: true,
      desiredOutcome: true,
      commercialSituations: { select: { triggerDescription: true } },
      buyingDecisions: { select: { participants: { select: { id: true } } } },
      beliefMaps: {
        select: {
          betterBeliefStatement: true,
          betterCommercialDecision: true,
          evidenceLinks: { select: { id: true } },
        },
      },
    },
  });

  const total = cohorts.length;
  const count = (predicate: (c: (typeof cohorts)[number]) => boolean) => cohorts.filter(predicate).length;

  const stats: ReadinessStats = {
    cohortDefinition: {
      total,
      covered: count((c) => Boolean(c.definition && c.commercialContext && c.currentBelief && c.desiredOutcome)),
    },
    commercialSituations: { total, covered: count((c) => c.commercialSituations.length > 0) },
    triggers: { total, covered: count((c) => c.commercialSituations.some((s) => Boolean(s.triggerDescription))) },
    buyingDecisions: { total, covered: count((c) => c.buyingDecisions.length > 0) },
    buyingCommittee: { total, covered: count((c) => c.buyingDecisions.some((d) => d.participants.length > 0)) },
    beliefs: { total, covered: count((c) => c.beliefMaps.some((b) => Boolean(b.betterBeliefStatement))) },
    evidenceCoverage: { total, covered: count((c) => c.beliefMaps.some((b) => b.evidenceLinks.length > 0)) },
    betterDecisions: { total, covered: count((c) => c.beliefMaps.some((b) => Boolean(b.betterCommercialDecision))) },
  };

  return computeStrategyReadiness(stats);
}

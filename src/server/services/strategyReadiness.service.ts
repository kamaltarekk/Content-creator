import "server-only";

import type { Prisma } from "@prisma/client";

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

async function loadCohortReadinessRows(clientId: string) {
  return prisma.cohort.findMany({
    where: { clientId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      name: true,
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
}

/**
 * Aggregates live strategy data for a client into the stats the pure
 * calculator needs. Cohorts are the unit of analysis: a client with zero
 * cohorts scores 0 everywhere, since none of the reasoning chain exists yet.
 */
export async function getStrategyReadinessForClient(clientId: string): Promise<StrategyReadinessResult> {
  const cohorts = await loadCohortReadinessRows(clientId);

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

export type PerCohortReadiness = {
  cohortId: string;
  cohortName: string;
  missingCategories: ReadinessCategory[];
};

/** Per-cohort breakdown of which categories in the reasoning chain are still missing — the basis for specific follow-up questions. */
export async function getPerCohortReadiness(clientId: string): Promise<PerCohortReadiness[]> {
  const cohorts = await loadCohortReadinessRows(clientId);

  return cohorts.map((c) => {
    const missing: ReadinessCategory[] = [];
    if (!(c.definition && c.commercialContext && c.currentBelief && c.desiredOutcome)) missing.push("cohortDefinition");
    if (c.commercialSituations.length === 0) missing.push("commercialSituations");
    if (!c.commercialSituations.some((s) => Boolean(s.triggerDescription))) missing.push("triggers");
    if (c.buyingDecisions.length === 0) missing.push("buyingDecisions");
    if (!c.buyingDecisions.some((d) => d.participants.length > 0)) missing.push("buyingCommittee");
    if (!c.beliefMaps.some((b) => Boolean(b.betterBeliefStatement))) missing.push("beliefs");
    if (!c.beliefMaps.some((b) => b.evidenceLinks.length > 0)) missing.push("evidenceCoverage");
    if (!c.beliefMaps.some((b) => Boolean(b.betterCommercialDecision))) missing.push("betterDecisions");
    return { cohortId: c.id, cohortName: c.name, missingCategories: missing };
  });
}

/** Specific (not generic) follow-up questions: the category question, phrased against the actual cohort that's missing it. */
export async function getSpecificFollowUpQuestions(clientId: string): Promise<{ cohortName: string; category: ReadinessCategory; question: string }[]> {
  const perCohort = await getPerCohortReadiness(clientId);
  return perCohort.flatMap((c) =>
    c.missingCategories.map((category) => ({
      cohortName: c.cohortName,
      category,
      question: `For "${c.cohortName}": ${STRATEGY_FOLLOWUP_QUESTIONS[category]}`,
    })),
  );
}

export async function createReadinessSnapshot(params: { clientId: string; generatedById?: string | null }) {
  const readiness = await getStrategyReadinessForClient(params.clientId);
  const specificQuestions = await getSpecificFollowUpQuestions(params.clientId);

  return prisma.strategyReadinessSnapshot.create({
    data: {
      clientId: params.clientId,
      overallScore: readiness.overall,
      sectionScores: readiness.categories as unknown as Prisma.InputJsonValue,
      followUpQuestions: specificQuestions.map((q) => q.question).slice(0, 30),
      generatedById: params.generatedById ?? null,
    },
  });
}

export function listReadinessSnapshots(clientId: string) {
  return prisma.strategyReadinessSnapshot.findMany({
    where: { clientId },
    orderBy: { generatedAt: "desc" },
    take: 20,
  });
}

import { describe, expect, it } from "vitest";

import { computeStrategyReadiness, type ReadinessStats } from "@/server/services/strategyReadiness.service";
import { READINESS_WEIGHTS } from "@/server/domain/strategy-schema";

function emptyStats(): ReadinessStats {
  return {
    cohortDefinition: { covered: 0, total: 0 },
    commercialSituations: { covered: 0, total: 0 },
    triggers: { covered: 0, total: 0 },
    buyingDecisions: { covered: 0, total: 0 },
    buyingCommittee: { covered: 0, total: 0 },
    beliefs: { covered: 0, total: 0 },
    evidenceCoverage: { covered: 0, total: 0 },
    betterDecisions: { covered: 0, total: 0 },
  };
}

describe("computeStrategyReadiness", () => {
  it("is 0% with no cohorts", () => {
    const result = computeStrategyReadiness(emptyStats());
    expect(result.overall).toBe(0);
    expect(result.categories).toHaveLength(8);
    expect(result.followUpQuestions.length).toBe(8);
  });

  it("reaches 100 when every category is fully covered", () => {
    const stats = emptyStats();
    for (const category of Object.keys(stats) as (keyof ReadinessStats)[]) {
      stats[category] = { covered: 2, total: 2 };
    }
    const result = computeStrategyReadiness(stats);
    expect(result.overall).toBe(100);
    expect(result.followUpQuestions).toHaveLength(0);
  });

  it("weights each category correctly", () => {
    const stats = emptyStats();
    stats.cohortDefinition = { covered: 1, total: 1 };
    const result = computeStrategyReadiness(stats);
    const cohortDef = result.categories.find((c) => c.category === "cohortDefinition")!;
    expect(cohortDef.weight).toBe(READINESS_WEIGHTS.cohortDefinition);
    expect(cohortDef.weightedContribution).toBe(READINESS_WEIGHTS.cohortDefinition);
    expect(result.overall).toBe(READINESS_WEIGHTS.cohortDefinition);
  });

  it("surfaces follow-up questions only for categories below the weak threshold", () => {
    const stats = emptyStats();
    stats.beliefs = { covered: 9, total: 10 }; // 0.9 coverage, above threshold
    stats.evidenceCoverage = { covered: 1, total: 10 }; // 0.1 coverage, below threshold
    const result = computeStrategyReadiness(stats);
    expect(result.followUpQuestions.some((q) => q.category === "beliefs")).toBe(false);
    expect(result.followUpQuestions.some((q) => q.category === "evidenceCoverage")).toBe(true);
  });
});

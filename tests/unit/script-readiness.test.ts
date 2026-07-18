import { describe, expect, it } from "vitest";

import { computeScriptReadiness, type ReadinessFacts } from "@/server/domain/script-readiness";

const READY_FACTS: ReadinessFacts = {
  hasWhatTheySell: true,
  hasApprovedAudience: true,
  hasSituationOrProblem: true,
  hasCurrentBelief: true,
  hasBetterBelief: true,
  hasLanguage: true,
  hasVoice: true,
  hasContentObjective: true,
  hasApprovedOffer: false,
  hasApprovedCta: false,
  hasSafeApprovedClaim: false,
  hasRelevantProofOrNonPerformancePositioning: false,
  hasUnresolvedCriticalClaimConflict: false,
};

describe("computeScriptReadiness", () => {
  it("blocks any Reel when a required-for-any-Reel fact is missing", () => {
    const result = computeScriptReadiness({ ...READY_FACTS, hasCurrentBelief: false });
    expect(result.readyForEducational).toBe(false);
    expect(result.readyForCommercial).toBe(false);
    expect(result.statements[0]).toMatch(/current belief/i);
    expect(result.gaps.some((g) => g.key === "hasCurrentBelief" && g.scope === "ANY_REEL")).toBe(true);
  });

  it("never blocks educational content on missing pricing or proof, but still blocks commercial", () => {
    const result = computeScriptReadiness(READY_FACTS);
    expect(result.readyForEducational).toBe(true);
    expect(result.readyForCommercial).toBe(false);
    expect(result.statements).toContain("Ready to create educational Reels.");
    expect(result.gaps.every((g) => g.scope === "COMMERCIAL_REEL")).toBe(true);
    expect(result.gaps.some((g) => g.key === "hasRelevantProofOrNonPerformancePositioning")).toBe(true);
  });

  it("is fully ready for commercial Reels once every commercial gate is satisfied", () => {
    const result = computeScriptReadiness({
      ...READY_FACTS,
      hasApprovedOffer: true,
      hasApprovedCta: true,
      hasSafeApprovedClaim: true,
      hasRelevantProofOrNonPerformancePositioning: true,
    });
    expect(result.readyForEducational).toBe(true);
    expect(result.readyForCommercial).toBe(true);
    expect(result.gaps).toHaveLength(0);
    expect(result.statements).toEqual(["Ready to create educational Reels.", "Ready to create commercial Reels."]);
  });

  it("blocks commercial Reels on an unresolved critical claim conflict even when every other gate passes", () => {
    const result = computeScriptReadiness({
      ...READY_FACTS,
      hasApprovedOffer: true,
      hasApprovedCta: true,
      hasSafeApprovedClaim: true,
      hasRelevantProofOrNonPerformancePositioning: true,
      hasUnresolvedCriticalClaimConflict: true,
    });
    expect(result.readyForEducational).toBe(true);
    expect(result.readyForCommercial).toBe(false);
    expect(result.gaps.map((g) => g.key)).toEqual(["hasUnresolvedCriticalClaimConflict"]);
  });
});

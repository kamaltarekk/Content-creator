import { describe, expect, it } from "vitest";

import { validateBeliefQuality, type BeliefQualityInput } from "@/server/domain/belief-quality";

function belief(partial: Partial<BeliefQualityInput> = {}): BeliefQualityInput {
  return {
    currentBeliefStatement: "More leads will fix our weak sales conversion rate.",
    behaviorCaused: "Keeps increasing ad spend on top-of-funnel campaigns instead of fixing the sales handoff.",
    commercialConsequence: "CAC keeps rising while conversion stays flat, and marketing gets blamed for sales results.",
    betterBeliefStatement:
      "The conversion problem lives in the handoff between marketing-qualified leads and the sales follow-up process, not in lead volume.",
    betterCommercialDecision:
      "Redirect budget from top-of-funnel ads into a lead-handoff audit and a faster sales follow-up SLA.",
    hasEvidence: true,
    ...partial,
  };
}

describe("validateBeliefQuality", () => {
  it("scores a fully-developed, evidence-backed reframe as strong", () => {
    const result = validateBeliefQuality(belief());
    expect(result.level).toBe("strong");
    expect(result.isWeak).toBe(false);
    expect(result.isTrivialReframe).toBe(false);
  });

  it("flags a trivial antonym-swap reframe as insufficient", () => {
    const result = validateBeliefQuality(
      belief({
        currentBeliefStatement: "Marketing is difficult.",
        betterBeliefStatement: "Marketing can be easy.",
      }),
    );
    expect(result.isTrivialReframe).toBe(true);
    expect(result.issues.some((i) => i.field === "betterBeliefStatement")).toBe(true);
  });

  it("flags a better belief that is too similar to the current belief", () => {
    const result = validateBeliefQuality(
      belief({
        currentBeliefStatement: "More leads will fix our weak sales conversion rate problem.",
        betterBeliefStatement: "More leads will fix our weak sales conversion rate issue.",
      }),
    );
    expect(result.isTrivialReframe).toBe(true);
  });

  it("flags a better decision that just restates the better belief", () => {
    const result = validateBeliefQuality(
      belief({
        betterCommercialDecision:
          "The conversion problem lives in the handoff between marketing-qualified leads and the sales follow-up process, not in lead volume.",
      }),
    );
    expect(result.issues.some((i) => i.field === "betterCommercialDecision")).toBe(true);
  });

  it("flags missing evidence as a gap without treating it as a hard failure", () => {
    const result = validateBeliefQuality(belief({ hasEvidence: false }));
    expect(result.issues.some((i) => i.field === "evidence")).toBe(true);
    expect(result.level).not.toBe("weak");
  });

  it("scores a mostly-empty belief map as weak", () => {
    const result = validateBeliefQuality({
      currentBeliefStatement: "More leads will fix it.",
      behaviorCaused: null,
      commercialConsequence: null,
      betterBeliefStatement: null,
      betterCommercialDecision: null,
      hasEvidence: false,
    });
    expect(result.level).toBe("weak");
    expect(result.isWeak).toBe(true);
  });
});

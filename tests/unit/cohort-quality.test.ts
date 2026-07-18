import { describe, expect, it } from "vitest";

import { validateCohortQuality, type CohortQualityInput } from "@/server/domain/cohort-quality";

function cohort(partial: Partial<CohortQualityInput> = {}): CohortQualityInput {
  return {
    name: "Marketing managers blamed for weak sales conversion",
    definition:
      "Marketing managers at mid-size B2B companies who get blamed by leadership when sales conversion drops, even though the funnel gap is downstream of marketing's control.",
    role: "Marketing Manager",
    commercialContext: "Under pressure to prove marketing ROI after a bad quarter.",
    currentWorkflow: "Runs paid campaigns and reports MQLs monthly to the CEO.",
    currentBelief: "Believes more leads will fix the conversion problem.",
    desiredOutcome: "Wants to be seen as driving revenue, not just activity.",
    decisionRisk: "Budget could be cut if the next quarter doesn't improve.",
    hasCommercialSituation: true,
    hasTrigger: true,
    hasBuyingDecision: true,
    ...partial,
  };
}

describe("validateCohortQuality", () => {
  it("scores a fully-grounded cohort as strong", () => {
    const result = validateCohortQuality(cohort());
    expect(result.level).toBe("strong");
    expect(result.isWeak).toBe(false);
    expect(result.issues).toHaveLength(0);
  });

  it("flags a generic demographic label with no situational grounding as weak", () => {
    const result = validateCohortQuality(
      cohort({
        name: "Women 25-45",
        definition: null,
        commercialContext: null,
        currentWorkflow: null,
        currentBelief: null,
        desiredOutcome: null,
        decisionRisk: null,
        hasCommercialSituation: false,
        hasTrigger: false,
        hasBuyingDecision: false,
      }),
    );
    expect(result.isGenericLabel).toBe(true);
    expect(result.isWeak).toBe(true);
    expect(result.level).toBe("weak");
  });

  it("does not flag a short name as generic when it carries situational markers", () => {
    const result = validateCohortQuality(cohort({ name: "Managers blamed for missed targets" }));
    expect(result.isGenericLabel).toBe(false);
  });

  it("flags a missing commercial situation link", () => {
    const result = validateCohortQuality(cohort({ hasCommercialSituation: false, hasTrigger: false }));
    expect(result.issues.some((i) => i.field === "commercialSituation")).toBe(true);
  });

  it("flags a missing buying decision link", () => {
    const result = validateCohortQuality(cohort({ hasBuyingDecision: false }));
    expect(result.issues.some((i) => i.field === "buyingDecision")).toBe(true);
  });

  it("never mutates the input (pure function)", () => {
    const input = cohort();
    const snapshot = JSON.stringify(input);
    validateCohortQuality(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

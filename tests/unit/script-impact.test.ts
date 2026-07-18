import { describe, expect, it } from "vitest";

import { validateQuestionScriptImpact, hasScriptImpact } from "@/server/domain/script-impact";
import { QUESTION_CATALOG } from "@/server/domain/guided-question-catalog";

describe("validateQuestionScriptImpact", () => {
  it("rejects a question with no Script Impact", () => {
    expect(validateQuestionScriptImpact({ key: "test.no_impact", scriptImpacts: [] }).valid).toBe(false);
  });

  it("accepts a question with a real Script Impact", () => {
    expect(validateQuestionScriptImpact({ key: "test.has_impact", scriptImpacts: ["VOICE"] }).valid).toBe(true);
  });

  it("rejects SYSTEM_ONLY unless the key is on the operational allowlist", () => {
    const result = validateQuestionScriptImpact({ key: "random.internal_field", scriptImpacts: ["SYSTEM_ONLY"] });
    expect(result.valid).toBe(false);
  });

  it("accepts SYSTEM_ONLY for an allowlisted operational key", () => {
    const result = validateQuestionScriptImpact({ key: "business.client_name", scriptImpacts: ["SYSTEM_ONLY"] });
    expect(result.valid).toBe(true);
  });

  it("hasScriptImpact mirrors the emptiness check", () => {
    expect(hasScriptImpact([])).toBe(false);
    expect(hasScriptImpact(["BODY"])).toBe(true);
  });
});

describe("QUESTION_CATALOG", () => {
  it("every seeded question passes Script Impact validation", () => {
    for (const question of QUESTION_CATALOG) {
      const result = validateQuestionScriptImpact({ key: question.key, scriptImpacts: question.scriptImpacts });
      expect(result.valid, `${question.key}: ${result.reason}`).toBe(true);
    }
  });

  it("has no duplicate question keys", () => {
    const keys = QUESTION_CATALOG.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("covers all 9 Guided Setup sections", () => {
    const sections = new Set(QUESTION_CATALOG.map((q) => q.section));
    expect(sections.has("BUSINESS")).toBe(true);
    expect(sections.has("AUDIENCE")).toBe(true);
    expect(sections.has("BELIEF_DECISION")).toBe(true);
    expect(sections.has("OFFER")).toBe(true);
    expect(sections.has("PROOF")).toBe(true);
    expect(sections.has("VOICE")).toBe(true);
    expect(sections.has("EXECUTION")).toBe(true);
    expect(sections.has("SAFETY")).toBe(true);
  });

  it("conditional offer/proof questions declare their dependency", () => {
    const offerName = QUESTION_CATALOG.find((q) => q.key === "offer.name")!;
    expect(offerName.conditionalLogic).toEqual({ dependsOnKey: "offer.has_offer", equals: true });
  });
});

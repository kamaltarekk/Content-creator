import { describe, expect, it } from "vitest";

import { ScriptGenerationContextSchema } from "@/server/domain/script-generation-context";

function baseContext() {
  return {
    meta: { contextId: "ctx_1", clientId: "client_1", cohortId: "cohort_1", generatedAt: new Date().toISOString(), version: 1 },
    request: {
      cohortId: "cohort_1",
      contentObjective: "EDUCATION" as const,
      platform: "INSTAGRAM_REELS" as const,
      offerId: null,
      beliefMapId: null,
      commercialSituationId: null,
      ctaRoute: null,
      format: null,
      durationSeconds: null,
    },
    business: { whatTheySell: "Marketing consulting", businessModel: null, category: null },
    audience: {
      cohortName: "Marketing managers",
      role: null,
      activeProblem: null,
      triggerDescription: null,
      currentWorkflow: null,
      desiredOutcome: null,
      decisionRisk: null,
      platformPresence: [],
    },
    beliefChain: null,
    offer: null,
    proof: [],
    voice: {
      language: "English",
      dialect: null,
      tones: [],
      vocabulary: [],
      prohibitedPhrases: [],
      technicality: null,
      goodExample: null,
      badExample: null,
      languageMixing: null,
    },
    execution: { platform: "INSTAGRAM_REELS" as const, format: null, durationSeconds: null, speaker: null, editingLevel: null, cannotShow: [] },
    safety: { neverClaim: [], legalRestrictions: [], avoidTopics: [], testimonialsPublic: null, requiresApproval: null, expiredClaims: [] },
    grounding: { sourceReferences: [], missingCriticalInputWarnings: [] },
  };
}

describe("ScriptGenerationContextSchema", () => {
  it("accepts a well-formed compiled context", () => {
    expect(() => ScriptGenerationContextSchema.parse(baseContext())).not.toThrow();
  });

  it("rejects an unexpected extra field anywhere in the tree (strict)", () => {
    const withExtra = { ...baseContext(), business: { ...baseContext().business, unexpectedField: "leak" } };
    expect(() => ScriptGenerationContextSchema.parse(withExtra)).toThrow();
  });

  it("rejects an invalid contentObjective outside the enum", () => {
    const invalid = baseContext();
    // @ts-expect-error deliberately invalid for the test
    invalid.request.contentObjective = "NOT_A_REAL_OBJECTIVE";
    expect(() => ScriptGenerationContextSchema.parse(invalid)).toThrow();
  });

  it("rejects a non-positive version number", () => {
    const invalid = baseContext();
    invalid.meta.version = 0;
    expect(() => ScriptGenerationContextSchema.parse(invalid)).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import { computeReelValidation, isReadyToMarkReady } from "@/server/domain/reel-validation";
import type { ScriptGenerationContext } from "@/server/domain/script-generation-context";
import type { ReelScriptPackage } from "@/server/domain/reel-script-package";

function baseContext(overrides: Partial<ScriptGenerationContext> = {}): ScriptGenerationContext {
  return {
    meta: { contextId: "ctx_1", clientId: "client_1", cohortId: "cohort_1", generatedAt: new Date().toISOString(), version: 1 },
    request: {
      cohortId: "cohort_1",
      contentObjective: "EDUCATION",
      platform: "INSTAGRAM_REELS",
      offerId: null,
      beliefMapId: null,
      commercialSituationId: null,
      ctaRoute: null,
      format: null,
      durationSeconds: null,
    },
    business: { whatTheySell: "Marketing consulting", businessModel: null, category: null },
    audience: { cohortName: "Marketing managers", role: null, activeProblem: null, triggerDescription: null, currentWorkflow: null, desiredOutcome: null, decisionRisk: null, platformPresence: [] },
    beliefChain: null,
    offer: null,
    proof: [],
    voice: {
      language: "English",
      dialect: null,
      tones: ["Direct"],
      vocabulary: [],
      prohibitedPhrases: ["get rich quick"],
      technicality: "SIMPLE_WITH_BUSINESS_TERMS",
      goodExample: null,
      badExample: null,
      languageMixing: null,
    },
    execution: { platform: "INSTAGRAM_REELS", format: null, durationSeconds: null, speaker: null, editingLevel: "SIMPLE", cannotShow: [] },
    safety: { neverClaim: ["Guaranteed revenue growth"], legalRestrictions: [], avoidTopics: [], testimonialsPublic: null, requiresApproval: null, expiredClaims: [] },
    grounding: { sourceReferences: [{ entityType: "Cohort", entityId: "cohort_1", field: "name", approvalStatus: "APPROVED", approvedAt: null }], missingCriticalInputWarnings: [] },
    ...overrides,
  };
}

function basePackage(overrides: Partial<ReelScriptPackage> = {}): ReelScriptPackage {
  return {
    meta: { packageId: "pkg_1", clientId: "client_1", cohortId: "cohort_1", contextSnapshotId: "snap_1", generatedAt: new Date().toISOString(), contentObjective: "EDUCATION", platform: "INSTAGRAM_REELS" },
    strategy: { funnelStage: "Top", cognitiveObjective: "Educate", coreTakeaway: "One idea.", beliefShiftFrom: null, beliefShiftTo: null, rationale: "Grounded." },
    hookOptions: [
      { hookType: "EDUCATIONAL", text: "Hook one.", rationale: "r" },
      { hookType: "STORY", text: "Hook two.", rationale: "r" },
      { hookType: "CONTRARIAN", text: "Hook three.", rationale: "r" },
    ],
    selectedHookIndex: 0,
    script: {
      segments: [{ type: "HOOK", text: "This is a short, simple sentence.", visualDirection: null, estimatedSeconds: 5 }],
      fullText: "This is a short, simple sentence.",
      // 7 words at 150 wpm (English default) = 2.8s
      estimatedDurationSeconds: 3,
      wordCount: 7,
    },
    production: { format: "TALKING_HEAD", speaker: null, editingLevel: "SIMPLE", visualPlan: [], resources: [] },
    commercial: { portfolioRole: "VALUE", ctaType: "NONE", ctaText: null, promotionalIntensity: "NONE", claimStatus: "POSITIONING_ONLY" },
    audits: {
      strategicGrounding: { status: "PASS", note: "" },
      voiceAlignment: { status: "PASS", note: "" },
      claimSafety: { status: "PASS", note: "" },
      comprehension: { status: "PASS", note: "" },
      platformFit: { status: "PASS", note: "" },
      productionFeasibility: { status: "PASS", note: "" },
    },
    sources: [],
    warnings: [],
    optionalAlternatives: [],
    ...overrides,
  };
}

describe("computeReelValidation", () => {
  it("passes all 8 gates for a clean, well-grounded educational script", () => {
    const gates = computeReelValidation(baseContext(), basePackage());
    expect(gates).toHaveLength(8);
    expect(gates.every((g) => g.status === "PASS")).toBe(true);
    expect(isReadyToMarkReady(gates, [])).toBe(true);
  });

  it("fails claim safety when the script uses a prohibited claim", () => {
    const pkg = basePackage({ script: { ...basePackage().script, fullText: "We deliver guaranteed revenue growth every time." } });
    const gates = computeReelValidation(baseContext(), pkg);
    const claimSafety = gates.find((g) => g.key === "CLAIM_SAFETY")!;
    expect(claimSafety.status).toBe("FAIL");
    expect(isReadyToMarkReady(gates, [])).toBe(false);
  });

  it("fails voice when the script uses a prohibited phrase", () => {
    const pkg = basePackage({ script: { ...basePackage().script, fullText: "This is a get rich quick approach." } });
    const gates = computeReelValidation(baseContext(), pkg);
    expect(gates.find((g) => g.key === "VOICE")!.status).toBe("FAIL");
  });

  it("flags duration mismatch (spec: configurable words-per-minute by language)", () => {
    // 7 words at 150 wpm ~= 2.8s, but declared 60s — far outside the tolerance.
    const pkg = basePackage({ script: { ...basePackage().script, estimatedDurationSeconds: 60 } });
    const gates = computeReelValidation(baseContext(), pkg);
    expect(gates.find((g) => g.key === "DURATION")!.status).toBe("WARNING");
  });

  it("uses a different words-per-minute rate for Arabic", () => {
    const context = baseContext({ voice: { ...baseContext().voice, language: "Arabic" } });
    // 7 words at 130 wpm (Arabic) ~= 3.2s
    const pkg = basePackage({ script: { ...basePackage().script, estimatedDurationSeconds: 3.2 } });
    const gates = computeReelValidation(context, pkg);
    expect(gates.find((g) => g.key === "DURATION")!.status).toBe("PASS");
  });

  it("flags CTA fit when a call to action is requested with no text (readiness for a real CTA)", () => {
    const pkg = basePackage({ commercial: { portfolioRole: "COMMERCIAL_ASK", ctaType: "BOOK", ctaText: null, promotionalIntensity: "DIRECT", claimStatus: "POSITIONING_ONLY" } });
    const gates = computeReelValidation(baseContext(), pkg);
    expect(gates.find((g) => g.key === "CTA_FIT")!.status).toBe("FAIL");
  });

  it("warns CTA fit when a call to action has no approved route behind it", () => {
    const pkg = basePackage({ commercial: { portfolioRole: "COMMERCIAL_ASK", ctaType: "BOOK", ctaText: "Book a call", promotionalIntensity: "DIRECT", claimStatus: "POSITIONING_ONLY" } });
    const gates = computeReelValidation(baseContext(), pkg);
    expect(gates.find((g) => g.key === "CTA_FIT")!.status).toBe("WARNING");
  });

  it("passes CTA fit when the CTA has an approved route", () => {
    const context = baseContext({ request: { ...baseContext().request, ctaRoute: "Book a call" } });
    const pkg = basePackage({ commercial: { portfolioRole: "COMMERCIAL_ASK", ctaType: "BOOK", ctaText: "Book a call", promotionalIntensity: "DIRECT", claimStatus: "POSITIONING_ONLY" } });
    const gates = computeReelValidation(context, pkg);
    expect(gates.find((g) => g.key === "CTA_FIT")!.status).toBe("PASS");
  });

  it("marks ready when a failing gate has an authorized override", () => {
    const pkg = basePackage({ script: { ...basePackage().script, fullText: "We deliver guaranteed revenue growth every time." } });
    const gates = computeReelValidation(baseContext(), pkg);
    expect(isReadyToMarkReady(gates, [])).toBe(false);
    const overridden = isReadyToMarkReady(gates, [{ gateKey: "CLAIM_SAFETY", reason: "Client has a written contractual guarantee.", overriddenBy: "user_1", overriddenAt: new Date().toISOString() }]);
    expect(overridden).toBe(true);
  });
});

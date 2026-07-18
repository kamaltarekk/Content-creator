import { describe, expect, it } from "vitest";

import { ReelScriptPackageSchema } from "@/server/domain/reel-script-package";

function baseHook(hookType: string, text: string) {
  return { hookType, text, rationale: "Grounded in the approved context." };
}

function basePackage() {
  return {
    meta: {
      packageId: "pkg_1",
      clientId: "client_1",
      cohortId: "cohort_1",
      contextSnapshotId: "snap_1",
      generatedAt: new Date().toISOString(),
      contentObjective: "EDUCATION",
      platform: "INSTAGRAM_REELS",
    },
    strategy: {
      funnelStage: "Top of funnel",
      cognitiveObjective: "Introduce a new frame",
      coreTakeaway: "Marketing is a system, not a cost.",
      beliefShiftFrom: null,
      beliefShiftTo: null,
      rationale: "Grounded in the approved belief chain.",
    },
    hookOptions: [baseHook("EDUCATIONAL", "Here's why marketing feels expensive."), baseHook("STORY", "A client told me this once."), baseHook("CONTRARIAN", "Marketing isn't a cost center.")],
    selectedHookIndex: 0,
    script: {
      segments: [{ type: "HOOK", text: "Here's why marketing feels expensive.", visualDirection: null, estimatedSeconds: 5 }],
      fullText: "Here's why marketing feels expensive.",
      estimatedDurationSeconds: 45,
      wordCount: 8,
    },
    production: { format: "TALKING_HEAD", speaker: null, editingLevel: "MODERATE", visualPlan: [], resources: [] },
    commercial: { portfolioRole: "VALUE", ctaType: "NONE", ctaText: null, promotionalIntensity: "NONE", claimStatus: "POSITIONING_ONLY" },
    audits: {
      strategicGrounding: { status: "PASS", note: "ok" },
      voiceAlignment: { status: "PASS", note: "ok" },
      claimSafety: { status: "PASS", note: "ok" },
      comprehension: { status: "PASS", note: "ok" },
      platformFit: { status: "PASS", note: "ok" },
      productionFeasibility: { status: "PASS", note: "ok" },
    },
    sources: [],
    warnings: [],
    optionalAlternatives: [],
  };
}

describe("ReelScriptPackageSchema", () => {
  it("accepts a well-formed package with exactly 3 hook options", () => {
    expect(() => ReelScriptPackageSchema.parse(basePackage())).not.toThrow();
  });

  it("rejects a package with only 2 hook options", () => {
    const invalid = basePackage();
    invalid.hookOptions = invalid.hookOptions.slice(0, 2);
    expect(() => ReelScriptPackageSchema.parse(invalid)).toThrow();
  });

  it("rejects a package with 4 hook options", () => {
    const invalid = basePackage();
    invalid.hookOptions = [...invalid.hookOptions, baseHook("COMPARISON", "A fourth hook.")];
    expect(() => ReelScriptPackageSchema.parse(invalid)).toThrow();
  });

  it("rejects a selectedHookIndex outside the 3 options", () => {
    const invalid = basePackage();
    invalid.selectedHookIndex = 3;
    expect(() => ReelScriptPackageSchema.parse(invalid)).toThrow();
  });

  it("rejects an unexpected extra field (strict)", () => {
    const invalid = { ...basePackage(), extraField: "should not be here" };
    expect(() => ReelScriptPackageSchema.parse(invalid)).toThrow();
  });
});

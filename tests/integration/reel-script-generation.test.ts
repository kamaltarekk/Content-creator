import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { generateReelScript } from "@/server/services/reelScriptGeneration.service";
import type { AIProvider, ClassificationResult, ClassifyBlockInput } from "@/server/providers/ai/ai.provider";
import type { StrategySuggestionResult, SuggestStrategyInput } from "@/server/domain/strategy-suggestion";
import type { GuidedAnswerSuggestionResult, SuggestGuidedAnswerInput } from "@/server/domain/guided-answer-suggestion";
import type { ReelScriptDraft } from "@/server/domain/reel-script-package";
import type { ScriptGenerationContext } from "@/server/domain/script-generation-context";

const RUN_ID = `reel-gen-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let userId: string;
let clientId: string;
let cohortId: string;

function fakeDraft(overrides: Partial<ReelScriptDraft> = {}): ReelScriptDraft {
  return {
    strategy: {
      funnelStage: "Top of funnel",
      cognitiveObjective: "Reframe a belief",
      coreTakeaway: "Marketing is a system, not a cost.",
      beliefShiftFrom: "Marketing is a cost center.",
      beliefShiftTo: "Marketing is a revenue system.",
      rationale: "Grounded in the approved belief chain and audience.",
    },
    hookOptions: [
      { hookType: "EDUCATIONAL", text: "Here's why marketing feels expensive.", rationale: "Direct." },
      { hookType: "STORY", text: "A founder told me this once.", rationale: "Story-driven." },
      { hookType: "CONTRARIAN", text: "Marketing isn't the cost you think it is.", rationale: "Contrarian." },
    ],
    selectedHookIndex: 0,
    script: {
      segments: [
        { type: "HOOK", text: "Here's why marketing feels expensive.", visualDirection: null, estimatedSeconds: 5 },
        { type: "PAYOFF", text: "Marketing is a system, not a cost.", visualDirection: null, estimatedSeconds: 5 },
      ],
      fullText: "Here's why marketing feels expensive. Marketing is a system, not a cost.",
      estimatedDurationSeconds: 45,
      wordCount: 12,
    },
    production: { format: "TALKING_HEAD", speaker: "Client", editingLevel: "MODERATE", visualPlan: ["Direct to camera"], resources: [] },
    commercial: { portfolioRole: "VALUE", ctaType: "NONE", ctaText: null, promotionalIntensity: "NONE", claimStatus: "POSITIONING_ONLY" },
    optionalAlternatives: [],
    ...overrides,
  };
}

class FakeReelProvider implements AIProvider {
  constructor(private draft: ReelScriptDraft) {}
  async classifyBlock(input: ClassifyBlockInput): Promise<ClassificationResult> {
    throw new Error(`not used (${input.blockText.slice(0, 5)})`);
  }
  async suggestStrategy(input: SuggestStrategyInput): Promise<StrategySuggestionResult> {
    throw new Error(`not used (${input.targetType})`);
  }
  async suggestGuidedAnswer(input: SuggestGuidedAnswerInput): Promise<GuidedAnswerSuggestionResult> {
    throw new Error(`not used (${input.question.slice(0, 5)})`);
  }
  async generateReelScript(context: ScriptGenerationContext): Promise<ReelScriptDraft> {
    void context;
    return this.draft;
  }
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `ReelGenOrg ${RUN_ID}`, slug: `reel-gen-org-${RUN_ID}` } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { name: "Reel Gen User", email: `reel-gen-${RUN_ID}@test`, passwordHash: "x" } });
  userId = user.id;
  const client = await prisma.client.create({
    data: { organizationId: orgId, name: `ReelGenClient ${RUN_ID}`, displayName: "Reel Gen Client", brandType: "PERSONAL_BRAND" },
  });
  clientId = client.id;

  await prisma.clientBrainItem.create({
    data: { clientId, sectionKey: "BUSINESS", fieldKey: "PRODUCTS_SERVICES", valueText: "1:1 marketing consulting.", status: "ACTIVE", currentVersionNumber: 1, createdById: userId },
  });
  await prisma.clientBrainItem.create({
    data: { clientId, sectionKey: "VOICE", fieldKey: "LANGUAGE", valueText: "English", status: "ACTIVE", currentVersionNumber: 1, createdById: userId },
  });
  await prisma.clientBrainItem.create({
    data: { clientId, sectionKey: "VOICE", fieldKey: "TONE", valueText: "Direct", status: "ACTIVE", currentVersionNumber: 1, createdById: userId },
  });

  const cohort = await prisma.cohort.create({ data: { clientId, name: "Marketing managers", approvalStatus: "APPROVED", createdById: userId } });
  cohortId = cohort.id;
  await prisma.beliefMap.create({
    data: {
      clientId,
      cohortId,
      currentBeliefStatement: "Marketing is a cost center.",
      betterBeliefStatement: "Marketing is a revenue system.",
      approvalStatus: "APPROVED",
      createdById: userId,
    },
  });
});

afterAll(async () => {
  await prisma.scriptContextSnapshot.deleteMany({ where: { clientId } });
  await prisma.beliefMap.deleteMany({ where: { clientId } });
  await prisma.cohort.deleteMany({ where: { clientId } });
  await prisma.clientBrainItemVersion.deleteMany({ where: { item: { clientId } } });
  await prisma.clientBrainItem.deleteMany({ where: { clientId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.client.delete({ where: { id: clientId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.organization.delete({ where: { id: orgId } });
});

describe("generateReelScript (integration)", () => {
  it("assembles a complete, schema-valid ReelScriptPackage and persists an immutable context snapshot", async () => {
    const result = await generateReelScript({
      clientId,
      cohortId,
      contentObjective: "BELIEF_CHANGE",
      platform: "INSTAGRAM_REELS",
      organizationId: orgId,
      actorUserId: userId,
      providerOverride: new FakeReelProvider(fakeDraft()),
    });

    expect(result.package.hookOptions).toHaveLength(3);
    expect(result.package.meta.cohortId).toBe(cohortId);
    expect(result.package.audits.strategicGrounding.status).toBe("PASS");
    expect(result.package.sources.length).toBeGreaterThan(0);

    const snapshot = await prisma.scriptContextSnapshot.findUniqueOrThrow({ where: { id: result.snapshotId } });
    expect(snapshot.clientId).toBe(clientId);
    expect(snapshot.generationPurpose).toBe("reel:BELIEF_CHANGE");
  });

  it("flags claim safety FAIL when the draft claims verified results with no approved proof", async () => {
    const draft = fakeDraft({ commercial: { portfolioRole: "COMMERCIAL_ASK", ctaType: "BOOK", ctaText: "Book a call", promotionalIntensity: "DIRECT", claimStatus: "APPROVED" } });

    const result = await generateReelScript({
      clientId,
      cohortId,
      contentObjective: "OFFER_PROMOTION",
      platform: "INSTAGRAM_REELS",
      organizationId: orgId,
      actorUserId: userId,
      providerOverride: new FakeReelProvider(draft),
    });

    expect(result.package.audits.claimSafety.status).toBe("FAIL");
  });

  it("flags platform fit as a WARNING when the estimated duration is long for Instagram Reels", async () => {
    const draft = fakeDraft({ script: { ...fakeDraft().script, estimatedDurationSeconds: 120 } });

    const result = await generateReelScript({
      clientId,
      cohortId,
      contentObjective: "EDUCATION",
      platform: "INSTAGRAM_REELS",
      organizationId: orgId,
      actorUserId: userId,
      providerOverride: new FakeReelProvider(draft),
    });

    expect(result.package.audits.platformFit.status).toBe("WARNING");
  });
});

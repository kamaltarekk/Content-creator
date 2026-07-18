import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { generateReelScript } from "@/server/services/reelScriptGeneration.service";
import { createReelGeneration, getReelGeneration } from "@/server/services/reelScriptVersion.service";
import { applyHookSelection, applyScriptEdit, regenerateReel } from "@/server/services/reelScriptEdit.service";
import type { AIProvider, ClassificationResult, ClassifyBlockInput } from "@/server/providers/ai/ai.provider";
import type { StrategySuggestionResult, SuggestStrategyInput } from "@/server/domain/strategy-suggestion";
import type { GuidedAnswerSuggestionResult, SuggestGuidedAnswerInput } from "@/server/domain/guided-answer-suggestion";
import type { ReelScriptDraft } from "@/server/domain/reel-script-package";
import type { ScriptGenerationContext } from "@/server/domain/script-generation-context";

const RUN_ID = `reel-edit-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let userId: string;
let clientId: string;
let cohortId: string;
let reelGenerationId: string;

function fakeDraft(): ReelScriptDraft {
  return {
    strategy: { funnelStage: "Top", cognitiveObjective: "Educate", coreTakeaway: "One idea.", beliefShiftFrom: null, beliefShiftTo: null, rationale: "Grounded." },
    hookOptions: [
      { hookType: "EDUCATIONAL", text: "Original hook.", rationale: "r" },
      { hookType: "STORY", text: "Story hook.", rationale: "r" },
      { hookType: "CONTRARIAN", text: "Contrarian hook.", rationale: "r" },
    ],
    selectedHookIndex: 0,
    script: {
      segments: [
        { type: "HOOK", text: "Original hook.", visualDirection: null, estimatedSeconds: 5 },
        { type: "PAYOFF", text: "A short simple sentence about marketing.", visualDirection: null, estimatedSeconds: 5 },
      ],
      fullText: "Original hook. A short simple sentence about marketing.",
      estimatedDurationSeconds: 4,
      wordCount: 10,
    },
    production: { format: "TALKING_HEAD", speaker: "Client", editingLevel: "SIMPLE", visualPlan: [], resources: [] },
    commercial: { portfolioRole: "VALUE", ctaType: "NONE", ctaText: null, promotionalIntensity: "NONE", claimStatus: "POSITIONING_ONLY" },
    optionalAlternatives: [],
  };
}

class FakeReelProvider implements AIProvider {
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
    return fakeDraft();
  }
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `ReelEditOrg ${RUN_ID}`, slug: `reel-edit-org-${RUN_ID}` } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { name: "Reel Edit User", email: `reel-edit-${RUN_ID}@test`, passwordHash: "x" } });
  userId = user.id;
  const client = await prisma.client.create({
    data: { organizationId: orgId, name: `ReelEditClient ${RUN_ID}`, displayName: "Reel Edit Client", brandType: "PERSONAL_BRAND" },
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

  const generated = await generateReelScript({
    clientId,
    cohortId,
    contentObjective: "EDUCATION",
    platform: "INSTAGRAM_REELS",
    organizationId: orgId,
    actorUserId: userId,
    providerOverride: new FakeReelProvider(),
  });
  const created = await createReelGeneration({
    clientId,
    cohortId,
    organizationId: orgId,
    actorUserId: userId,
    contextSnapshotId: generated.snapshotId,
    package: generated.package,
    validation: generated.validation,
  });
  reelGenerationId = created.generationId;
});

afterAll(async () => {
  await prisma.reelVersion.deleteMany({ where: { reelGeneration: { clientId } } });
  await prisma.reelGeneration.deleteMany({ where: { clientId } });
  await prisma.scriptContextSnapshot.deleteMany({ where: { clientId } });
  await prisma.cohort.deleteMany({ where: { clientId } });
  await prisma.clientBrainItemVersion.deleteMany({ where: { item: { clientId } } });
  await prisma.clientBrainItem.deleteMany({ where: { clientId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.client.delete({ where: { id: clientId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.organization.delete({ where: { id: orgId } });
});

describe("reelScriptEdit (integration)", () => {
  it("applyHookSelection swaps the selected hook into the opening HOOK segment and creates a new version", async () => {
    const result = await applyHookSelection({ reelGenerationId, organizationId: orgId, actorUserId: userId, hookIndex: 1 });
    expect(result.versionNumber).toBe(2);

    const generation = await getReelGeneration(reelGenerationId);
    const latest = generation.versions.find((v) => v.versionNumber === 2)!;
    const pkg = latest.packageJson as { selectedHookIndex: number; script: { segments: { type: string; text: string }[] } };
    expect(pkg.selectedHookIndex).toBe(1);
    expect(pkg.script.segments[0].text).toBe("Story hook.");
  });

  it("rejects an out-of-range hook index", async () => {
    await expect(applyHookSelection({ reelGenerationId, organizationId: orgId, actorUserId: userId, hookIndex: 9 })).rejects.toThrow();
  });

  it("applyScriptEdit recomputes word count and duration from the edited segments", async () => {
    const result = await applyScriptEdit({
      reelGenerationId,
      organizationId: orgId,
      actorUserId: userId,
      segments: [{ type: "HOOK", text: "A brand new hook sentence here.", visualDirection: null, estimatedSeconds: 6 }],
    });
    expect(result.versionNumber).toBe(3);

    const generation = await getReelGeneration(reelGenerationId);
    const latest = generation.versions.find((v) => v.versionNumber === 3)!;
    const pkg = latest.packageJson as { script: { wordCount: number; estimatedDurationSeconds: number; fullText: string } };
    expect(pkg.script.fullText).toBe("A brand new hook sentence here.");
    expect(pkg.script.wordCount).toBe(6);
    expect(pkg.script.estimatedDurationSeconds).toBe(6);
  });

  it("regenerateReel reruns generation for the same cohort/objective and adds a new version", async () => {
    const result = await regenerateReel({ clientId, reelGenerationId, organizationId: orgId, actorUserId: userId, providerOverride: new FakeReelProvider() });
    expect(result.versionNumber).toBe(4);

    const generation = await getReelGeneration(reelGenerationId);
    expect(generation.currentVersionNumber).toBe(4);
    expect(generation.versions).toHaveLength(4);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { generateReelScript } from "@/server/services/reelScriptGeneration.service";
import { createReelGeneration, createReelVersion, getReelGeneration } from "@/server/services/reelScriptVersion.service";
import { recordValidationOverride } from "@/server/services/reelScriptValidation.service";
import type { AIProvider, ClassificationResult, ClassifyBlockInput } from "@/server/providers/ai/ai.provider";
import type { StrategySuggestionResult, SuggestStrategyInput } from "@/server/domain/strategy-suggestion";
import type { GuidedAnswerSuggestionResult, SuggestGuidedAnswerInput } from "@/server/domain/guided-answer-suggestion";
import type { ReelScriptDraft } from "@/server/domain/reel-script-package";
import type { ScriptGenerationContext } from "@/server/domain/script-generation-context";

const RUN_ID = `reel-ver-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let userId: string;
let clientId: string;
let cohortId: string;

function fakeDraft(): ReelScriptDraft {
  return {
    strategy: { funnelStage: "Top", cognitiveObjective: "Educate", coreTakeaway: "One idea.", beliefShiftFrom: null, beliefShiftTo: null, rationale: "Grounded." },
    hookOptions: [
      { hookType: "EDUCATIONAL", text: "Hook one.", rationale: "r" },
      { hookType: "STORY", text: "Hook two.", rationale: "r" },
      { hookType: "CONTRARIAN", text: "Hook three.", rationale: "r" },
    ],
    selectedHookIndex: 0,
    script: {
      segments: [{ type: "HOOK", text: "A short simple sentence about marketing.", visualDirection: null, estimatedSeconds: 5 }],
      fullText: "A short simple sentence about marketing.",
      estimatedDurationSeconds: 3,
      wordCount: 6,
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
  const org = await prisma.organization.create({ data: { name: `ReelVerOrg ${RUN_ID}`, slug: `reel-ver-org-${RUN_ID}` } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { name: "Reel Version User", email: `reel-ver-${RUN_ID}@test`, passwordHash: "x" } });
  userId = user.id;
  const client = await prisma.client.create({
    data: { organizationId: orgId, name: `ReelVerClient ${RUN_ID}`, displayName: "Reel Version Client", brandType: "PERSONAL_BRAND" },
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

describe("reelScriptVersion + reelScriptValidation (integration)", () => {
  it("creates a Reel generation as READY when every gate passes", async () => {
    const generated = await generateReelScript({
      clientId,
      cohortId,
      contentObjective: "EDUCATION",
      platform: "INSTAGRAM_REELS",
      organizationId: orgId,
      actorUserId: userId,
      providerOverride: new FakeReelProvider(),
    });
    expect(generated.validation.readyToMarkReady).toBe(true);

    const created = await createReelGeneration({
      clientId,
      cohortId,
      organizationId: orgId,
      actorUserId: userId,
      contextSnapshotId: generated.snapshotId,
      package: generated.package,
      validation: generated.validation,
    });
    expect(created.status).toBe("READY");

    const stored = await getReelGeneration(created.generationId);
    expect(stored.status).toBe("READY");
    expect(stored.currentVersionNumber).toBe(1);
    expect(stored.versions).toHaveLength(1);
  });

  it("bumps to version 2 without touching version 1, and an override can flip a blocked Reel to READY", async () => {
    const generated = await generateReelScript({
      clientId,
      cohortId,
      contentObjective: "OFFER_PROMOTION",
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
      package: { ...generated.package, commercial: { portfolioRole: "COMMERCIAL_ASK", ctaType: "BOOK", ctaText: "Book a call", promotionalIntensity: "DIRECT", claimStatus: "APPROVED" } },
      validation: { ...generated.validation, readyToMarkReady: false, gates: generated.validation.gates.map((g) => (g.key === "FACTUAL_GROUNDING" ? { ...g, status: "FAIL" as const } : g)) },
    });
    expect(created.status).toBe("DRAFT");

    const override = await recordValidationOverride({
      organizationId: orgId,
      clientId,
      actorUserId: userId,
      gateKey: "FACTUAL_GROUNDING",
      reason: "Client confirmed the result verbally; written case study pending.",
    });
    expect(override.overriddenBy).toBe(userId);

    const bumped = await createReelVersion({
      reelGenerationId: created.generationId,
      organizationId: orgId,
      actorUserId: userId,
      package: generated.package,
      validation: { gates: generated.validation.gates, readyToMarkReady: true, overrides: [override] },
      changeNote: "Applied an authorized override for factual grounding.",
    });
    expect(bumped.versionNumber).toBe(2);
    expect(bumped.status).toBe("READY");

    const stored = await getReelGeneration(created.generationId);
    expect(stored.currentVersionNumber).toBe(2);
    expect(stored.versions).toHaveLength(2);
    expect(stored.versions.find((v) => v.versionNumber === 1)).toBeTruthy();

    const auditRows = await prisma.auditLog.findMany({ where: { organizationId: orgId, entityType: "ReelValidationGate" } });
    expect(auditRows.length).toBeGreaterThan(0);
  });
});

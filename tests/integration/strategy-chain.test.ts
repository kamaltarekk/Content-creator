import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { createCohort, addCohortSourceReference } from "@/server/services/cohort.service";
import { createCommercialSituation } from "@/server/services/commercialSituation.service";
import { createBuyingDecision } from "@/server/services/buyingDecision.service";
import { addBuyingRoleParticipant } from "@/server/services/buyingCommittee.service";
import { createBeliefMap } from "@/server/services/belief.service";
import { addEvidenceLink } from "@/server/services/evidenceLink.service";
import { generateStrategySuggestion, resolveSuggestion } from "@/server/services/strategySuggestion.service";
import { getStrategyReadinessForClient } from "@/server/services/strategyReadiness.service";
import type { AIProvider, ClassificationResult, ClassifyBlockInput } from "@/server/providers/ai/ai.provider";
import type { StrategySuggestionResult, SuggestStrategyInput } from "@/server/domain/strategy-suggestion";
import type { GuidedAnswerSuggestionResult, SuggestGuidedAnswerInput } from "@/server/domain/guided-answer-suggestion";
import type { ReelScriptDraft } from "@/server/domain/reel-script-package";
import type { ScriptGenerationContext } from "@/server/domain/script-generation-context";

/**
 * The full Module 2 chain, end to end, with RUN_ID-namespaced fixtures
 * (mirrors tests/integration/review-approval.test.ts): create cohort -> link
 * source -> add commercial situation -> add buying decision -> add
 * buying-role participant -> create belief map -> link evidence -> approve
 * an AI suggestion -> detect duplicate -> generate a readiness report ->
 * confirm the audit trail records every step.
 */

const RUN_ID = `strat-chain-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let userId: string;
let clientId: string;

class FakeStrategyProvider implements AIProvider {
  constructor(private response: StrategySuggestionResult) {}
  async classifyBlock(input: ClassifyBlockInput): Promise<ClassificationResult> {
    throw new Error(`not used (block: ${input.blockText.slice(0, 10)})`);
  }
  async suggestStrategy(input: SuggestStrategyInput): Promise<StrategySuggestionResult> {
    void input;
    return this.response;
  }
  async suggestGuidedAnswer(input: SuggestGuidedAnswerInput): Promise<GuidedAnswerSuggestionResult> {
    throw new Error(`suggestGuidedAnswer is not used in this test (question: ${input.question.slice(0, 10)})`);
  }
  async generateReelScript(context: ScriptGenerationContext): Promise<ReelScriptDraft> {
    throw new Error(`generateReelScript is not used in this test (client: ${context.meta.clientId})`);
  }
}

afterAll(async () => {
  await prisma.strategySuggestionReview.deleteMany({ where: { clientId } });
  await prisma.strategySuggestion.deleteMany({ where: { clientId } });
  await prisma.strategicRelationship.deleteMany({ where: { clientId } });
  await prisma.strategicEntity.deleteMany({ where: { clientId } });
  await prisma.evidenceLink.deleteMany({ where: { clientId } });
  await prisma.beliefMapVersion.deleteMany({ where: { beliefMap: { clientId } } });
  await prisma.beliefMap.deleteMany({ where: { clientId } });
  await prisma.buyingRoleParticipant.deleteMany({ where: { clientId } });
  await prisma.buyingDecisionVersion.deleteMany({ where: { buyingDecision: { clientId } } });
  await prisma.buyingDecision.deleteMany({ where: { clientId } });
  await prisma.commercialSituationVersion.deleteMany({ where: { commercialSituation: { clientId } } });
  await prisma.commercialSituation.deleteMany({ where: { clientId } });
  await prisma.cohortSourceReference.deleteMany({ where: { cohort: { clientId } } });
  await prisma.cohortVersion.deleteMany({ where: { cohort: { clientId } } });
  await prisma.cohort.deleteMany({ where: { clientId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.client.delete({ where: { id: clientId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.organization.delete({ where: { id: orgId } });
});

describe("full strategy chain", () => {
  it("walks create -> link -> situation -> decision -> committee -> belief -> evidence -> AI approval -> readiness, with an audited trail throughout", async () => {
    const org = await prisma.organization.create({ data: { name: `ChainOrg ${RUN_ID}`, slug: `chain-org-${RUN_ID}` } });
    orgId = org.id;
    const user = await prisma.user.create({ data: { name: "Chain Strategist", email: `chain-${RUN_ID}@test`, passwordHash: "x" } });
    userId = user.id;
    const client = await prisma.client.create({
      data: { organizationId: orgId, name: `ChainClient ${RUN_ID}`, displayName: "Chain Client", brandType: "PERSONAL_BRAND" },
    });
    clientId = client.id;

    // Readiness starts at 0 — nothing exists yet.
    const initialReadiness = await getStrategyReadinessForClient(clientId);
    expect(initialReadiness.overall).toBe(0);

    // 1. Create cohort.
    const cohort = await createCohort({
      clientId,
      organizationId: orgId,
      actorUserId: userId,
      input: {
        name: "Chain-tested cohort",
        definition: "A cohort created purely to exercise the full integration chain.",
        commercialContext: "Needs the chain to work end to end.",
        currentBelief: "Testing is optional.",
        desiredOutcome: "A green test suite.",
        decisionRisk: "Shipping a broken chain.",
      },
    });

    // 2. Link a source reference.
    await addCohortSourceReference({
      cohortId: cohort.id,
      organizationId: orgId,
      linkedById: userId,
      relationshipType: "SUPPORTS",
      note: "Manually linked during the chain test.",
    });

    // 3. Add a commercial situation.
    const situation = await createCommercialSituation({
      clientId,
      cohortId: cohort.id,
      organizationId: orgId,
      actorUserId: userId,
      input: { title: "A triggering situation", triggerType: "EVENT", triggerDescription: "Something happened." },
    });

    // 4. Add a buying decision.
    const decision = await createBuyingDecision({
      clientId,
      cohortId: cohort.id,
      organizationId: orgId,
      actorUserId: userId,
      input: { title: "A decision to make", decisionType: "OTHER", commercialSituationId: situation.id },
    });

    // 5. Add a buying-role participant.
    await addBuyingRoleParticipant({
      buyingDecisionId: decision.id,
      organizationId: orgId,
      actorUserId: userId,
      input: { role: "DECISION_MAKER", label: "Chain Decider", influenceScore: 5 },
    });

    // 6. Create a belief map.
    const belief = await createBeliefMap({
      clientId,
      cohortId: cohort.id,
      organizationId: orgId,
      actorUserId: userId,
      input: {
        currentBeliefStatement: "Testing slows shipping down.",
        behaviorCaused: "Skips writing integration tests.",
        commercialConsequence: "Ships regressions that cost more time than the tests would have.",
        betterBeliefStatement: "A fast, targeted integration suite catches regressions before customers do.",
        betterCommercialDecision: "Write one chain test per module instead of skipping tests entirely.",
      },
    });

    // 7. Link evidence.
    await addEvidenceLink({
      clientId,
      organizationId: orgId,
      actorUserId: userId,
      targetEntityType: "BELIEF",
      targetEntityId: belief.id,
      beliefMapId: belief.id,
      input: { description: "This very test suite passing is the evidence.", evidenceStrength: "STRONG" },
    });

    // 8. Generate + approve an AI suggestion (a second, distinct cohort).
    const suggestion = await generateStrategySuggestion({
      clientId,
      organizationId: orgId,
      actorUserId: userId,
      targetType: "COHORT",
      providerOverride: new FakeStrategyProvider({
        suggestion_type: "COHORT",
        title: "Chain-suggested cohort",
        proposed_fields: { name: "Chain-suggested cohort", priority: "MEDIUM" },
        source_references: [],
        confidence: 0.8,
        reasoning_summary: "Suggested during the chain test.",
        missing_evidence: [],
        possible_conflicts: [],
        suggested_relationships: [],
      }),
    });
    const { resultingEntityId } = await resolveSuggestion({
      suggestionId: suggestion.id,
      organizationId: orgId,
      actorUserId: userId,
      action: "APPROVE",
    });
    expect(resultingEntityId).toBeTruthy();

    // 9. Detect a duplicate against that same suggested name.
    const duplicateSuggestion = await generateStrategySuggestion({
      clientId,
      organizationId: orgId,
      actorUserId: userId,
      targetType: "COHORT",
      providerOverride: new FakeStrategyProvider({
        suggestion_type: "COHORT",
        title: "Chain-suggested cohort duplicate",
        proposed_fields: { name: "Chain-suggested cohort" },
        source_references: [],
        confidence: 0.6,
        reasoning_summary: "A near-identical suggestion to test duplicate detection.",
        missing_evidence: [],
        possible_conflicts: [],
        suggested_relationships: [],
      }),
    });
    expect(duplicateSuggestion.isDuplicateCandidate).toBe(true);

    // 10. Readiness now reflects a fully-populated cohort (2 cohorts total: the manual one + the approved suggestion).
    const finalReadiness = await getStrategyReadinessForClient(clientId);
    expect(finalReadiness.overall).toBeGreaterThan(0);
    const beliefsCategory = finalReadiness.categories.find((c) => c.category === "beliefs")!;
    expect(beliefsCategory.covered).toBeGreaterThanOrEqual(1);

    // 11. The audit trail recorded every step (create cohort, link source, situation, decision,
    // participant, belief, evidence, suggestion, approval) without us ever calling logAudit directly here.
    const auditActions = await prisma.auditLog.findMany({ where: { organizationId: orgId }, select: { action: true, entityType: true } });
    const entityTypesLogged = new Set(auditActions.map((a) => a.entityType));
    for (const expected of [
      "Cohort",
      "CohortSourceReference",
      "CommercialSituation",
      "BuyingDecision",
      "BuyingRoleParticipant",
      "BeliefMap",
      "EvidenceLink",
      "StrategySuggestion",
    ]) {
      expect(entityTypesLogged.has(expected)).toBe(true);
    }
    expect(auditActions.some((a) => a.action === "SUGGEST")).toBe(true);
    expect(auditActions.some((a) => a.action === "APPROVE")).toBe(true);
  });
});

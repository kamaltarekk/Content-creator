import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { generateStrategySuggestion, resolveSuggestion, bulkApproveSuggestions } from "@/server/services/strategySuggestion.service";
import type { AIProvider } from "@/server/providers/ai/ai.provider";
import type { ClassificationResult, ClassifyBlockInput } from "@/server/providers/ai/ai.provider";
import type { StrategySuggestionResult, SuggestStrategyInput } from "@/server/domain/strategy-suggestion";
import type { GuidedAnswerSuggestionResult, SuggestGuidedAnswerInput } from "@/server/domain/guided-answer-suggestion";

const RUN_ID = `strat-sugg-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let userId: string;
let clientId: string;

class FakeStrategyProvider implements AIProvider {
  constructor(private response: StrategySuggestionResult) {}

  async classifyBlock(input: ClassifyBlockInput): Promise<ClassificationResult> {
    throw new Error(`classifyBlock is not used in this test (block: ${input.blockText.slice(0, 20)})`);
  }

  async suggestStrategy(input: SuggestStrategyInput): Promise<StrategySuggestionResult> {
    void input;
    return this.response;
  }

  async suggestGuidedAnswer(input: SuggestGuidedAnswerInput): Promise<GuidedAnswerSuggestionResult> {
    throw new Error(`suggestGuidedAnswer is not used in this test (question: ${input.question.slice(0, 10)})`);
  }
}

function cohortSuggestion(name: string, confidence = 0.9): StrategySuggestionResult {
  return {
    suggestion_type: "COHORT",
    title: name,
    proposed_fields: { name, priority: "HIGH" },
    source_references: [{ source_type: "AUDIENCE_SIGNAL", reference_id: "sig-1" }],
    confidence,
    reasoning_summary: "Grounded in a recurring audience signal.",
    missing_evidence: [],
    possible_conflicts: [],
    suggested_relationships: [],
  };
}

async function seedBase() {
  const org = await prisma.organization.create({ data: { name: `SuggOrg ${RUN_ID}`, slug: `sugg-org-${RUN_ID}` } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { name: "Reviewer", email: `sugg-${RUN_ID}@test`, passwordHash: "x" } });
  userId = user.id;
  const client = await prisma.client.create({
    data: { organizationId: orgId, name: `SuggClient ${RUN_ID}`, displayName: "Sugg Client", brandType: "PERSONAL_BRAND" },
  });
  clientId = client.id;
}

afterAll(async () => {
  await prisma.strategySuggestionReview.deleteMany({ where: { clientId } });
  await prisma.strategySuggestion.deleteMany({ where: { clientId } });
  await prisma.strategicEntity.deleteMany({ where: { clientId } });
  await prisma.cohortVersion.deleteMany({ where: { cohort: { clientId } } });
  await prisma.cohort.deleteMany({ where: { clientId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.client.delete({ where: { id: clientId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.organization.delete({ where: { id: orgId } });
});

describe("strategy suggestion pipeline", () => {
  it("generates a suggestion with a pending review and never auto-approves it", async () => {
    await seedBase();

    const suggestion = await generateStrategySuggestion({
      clientId,
      organizationId: orgId,
      actorUserId: userId,
      targetType: "COHORT",
      providerOverride: new FakeStrategyProvider(cohortSuggestion("Marketing managers blamed for weak conversion")),
    });

    expect(suggestion.status).toBe("AI_SUGGESTED");
    const review = await prisma.strategySuggestionReview.findUniqueOrThrow({ where: { strategySuggestionId: suggestion.id } });
    expect(review.status).toBe("PENDING");

    const cohortCount = await prisma.cohort.count({ where: { clientId } });
    expect(cohortCount).toBe(0); // nothing created until a human approves
  });

  it("detects a duplicate cohort suggestion against an existing cohort", async () => {
    await prisma.cohort.create({
      data: {
        clientId,
        name: "Marketing managers blamed for weak conversion",
        priority: "MEDIUM",
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        createdById: userId,
      },
    });

    const suggestion = await generateStrategySuggestion({
      clientId,
      organizationId: orgId,
      actorUserId: userId,
      targetType: "COHORT",
      providerOverride: new FakeStrategyProvider(cohortSuggestion("Marketing managers blamed for weak conversion rates")),
    });

    expect(suggestion.isDuplicateCandidate).toBe(true);
    expect(suggestion.duplicateOfEntityType).toBe("COHORT");
  });

  it("approving a suggestion creates the entity and resolves the review; rejecting creates nothing", async () => {
    const suggestion = await generateStrategySuggestion({
      clientId,
      organizationId: orgId,
      actorUserId: userId,
      targetType: "COHORT",
      providerOverride: new FakeStrategyProvider(cohortSuggestion("Founders overwhelmed by fundraising logistics")),
    });

    const { resultingEntityId } = await resolveSuggestion({
      suggestionId: suggestion.id,
      organizationId: orgId,
      actorUserId: userId,
      action: "APPROVE",
    });

    expect(resultingEntityId).toBeTruthy();
    const cohort = await prisma.cohort.findUniqueOrThrow({ where: { id: resultingEntityId! } });
    expect(cohort.approvalStatus).toBe("APPROVED");

    const resolvedReview = await prisma.strategySuggestionReview.findUniqueOrThrow({ where: { strategySuggestionId: suggestion.id } });
    expect(resolvedReview.status).toBe("RESOLVED");
    expect(resolvedReview.action).toBe("APPROVE");

    const rejected = await generateStrategySuggestion({
      clientId,
      organizationId: orgId,
      actorUserId: userId,
      targetType: "COHORT",
      providerOverride: new FakeStrategyProvider(cohortSuggestion("Solo consultants drowning in admin work")),
    });
    await resolveSuggestion({ suggestionId: rejected.id, organizationId: orgId, actorUserId: userId, action: "REJECT" });
    const rejectedCohort = await prisma.cohort.findFirst({ where: { clientId, name: "Solo consultants drowning in admin work" } });
    expect(rejectedCohort).toBeNull();
  });

  it("bulk-approve only applies to high-confidence, non-duplicate, conflict-free suggestions", async () => {
    const safe = await generateStrategySuggestion({
      clientId,
      organizationId: orgId,
      actorUserId: userId,
      targetType: "COHORT",
      providerOverride: new FakeStrategyProvider(cohortSuggestion("Freelance designers chasing inconsistent income", 0.9)),
    });
    const lowConfidence = await generateStrategySuggestion({
      clientId,
      organizationId: orgId,
      actorUserId: userId,
      targetType: "COHORT",
      providerOverride: new FakeStrategyProvider(cohortSuggestion("Retail owners unsure about ecommerce", 0.3)),
    });

    const result = await bulkApproveSuggestions({
      clientId,
      organizationId: orgId,
      actorUserId: userId,
      suggestionIds: [safe.id, lowConfidence.id],
    });

    expect(result.approved).toBe(1);
    expect(result.skipped).toBe(1);

    const safeSuggestion = await prisma.strategySuggestion.findUniqueOrThrow({ where: { id: safe.id } });
    expect(safeSuggestion.status).toBe("APPROVED");
    const lowConfidenceSuggestion = await prisma.strategySuggestion.findUniqueOrThrow({ where: { id: lowConfidence.id } });
    expect(lowConfidenceSuggestion.status).toBe("AI_SUGGESTED");
  });
});

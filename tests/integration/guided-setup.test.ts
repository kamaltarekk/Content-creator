import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { syncQuestionCatalog } from "@/server/services/guidedQuestion.service";
import { startOrResumeGuidedSetup } from "@/server/services/guidedSetup.service";
import { getNextQuestion, submitAnswer } from "@/server/services/guidedAnswer.service";

const RUN_ID = `guided-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let userId: string;
let clientId: string;

beforeAll(async () => {
  await syncQuestionCatalog();

  const org = await prisma.organization.create({ data: { name: `GuidedOrg ${RUN_ID}`, slug: `guided-org-${RUN_ID}` } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { name: "Setup User", email: `guided-${RUN_ID}@test`, passwordHash: "x" } });
  userId = user.id;
  const client = await prisma.client.create({
    data: { organizationId: orgId, name: `GuidedClient ${RUN_ID}`, displayName: "Guided Client", brandType: "PERSONAL_BRAND" },
  });
  clientId = client.id;

  // Pre-existing approved Client Brain item — should be reused, never re-asked.
  await prisma.clientBrainItem.create({
    data: {
      clientId,
      sectionKey: "BUSINESS",
      fieldKey: "PRODUCTS_SERVICES",
      valueText: "A one-session marketing decision consultation.",
      status: "ACTIVE",
      confidence: 0.9,
      currentVersionNumber: 1,
      createdById: userId,
    },
  });
});

afterAll(async () => {
  await prisma.guidedSetupAnswer.deleteMany({ where: { clientId } });
  await prisma.guidedSetupSession.deleteMany({ where: { clientId } });
  await prisma.strategicEntity.deleteMany({ where: { clientId } });
  await prisma.cohortVersion.deleteMany({ where: { cohort: { clientId } } });
  await prisma.cohort.deleteMany({ where: { clientId } });
  await prisma.clientBrainItemVersion.deleteMany({ where: { item: { clientId } } });
  await prisma.clientBrainItem.deleteMany({ where: { clientId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.client.delete({ where: { id: clientId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.organization.delete({ where: { id: orgId } });
});

describe("guided setup answer engine", () => {
  it("starts a session and offers the first question with a SYSTEM_ONLY prefill from the client record", async () => {
    const session = await startOrResumeGuidedSetup({ clientId, organizationId: orgId, userId });
    expect(session.status).toBe("IN_PROGRESS");

    const next = await getNextQuestion(session.id, clientId);
    expect(next?.question.key).toBe("business.client_name");
    expect(next?.trusted?.value).toBe("Guided Client");
  });

  it("resuming returns the same in-progress session rather than creating a new one", async () => {
    const first = await startOrResumeGuidedSetup({ clientId, organizationId: orgId, userId });
    const second = await startOrResumeGuidedSetup({ clientId, organizationId: orgId, userId });
    expect(second.id).toBe(first.id);
  });

  it("reuses an existing approved Client Brain item as a trusted prefill instead of asking again", async () => {
    const session = await startOrResumeGuidedSetup({ clientId, organizationId: orgId, userId });
    await submitAnswer({ sessionId: session.id, clientId, organizationId: orgId, userId, questionKey: "business.client_name", value: "Guided Client" });
    await submitAnswer({ sessionId: session.id, clientId, organizationId: orgId, userId, questionKey: "business.brand_type", value: "PERSONAL_BRAND" });

    const next = await getNextQuestion(session.id, clientId);
    expect(next?.question.key).toBe("business.what_they_sell");
    expect(next?.trusted?.value).toBe("A one-session marketing decision consultation.");
    expect(next?.trusted?.sourceType).toBe("EXISTING_CLIENT_BRAIN_ITEM");
  });

  it("never re-asks a question that already has an approved answer in this session", async () => {
    const session = await startOrResumeGuidedSetup({ clientId, organizationId: orgId, userId });
    await submitAnswer({
      sessionId: session.id,
      clientId,
      organizationId: orgId,
      userId,
      questionKey: "business.what_they_sell",
      value: "A one-session marketing decision consultation.",
    });

    const next = await getNextQuestion(session.id, clientId);
    expect(next?.question.key).not.toBe("business.client_name");
    expect(next?.question.key).not.toBe("business.brand_type");
    expect(next?.question.key).not.toBe("business.what_they_sell");
  });

  it("creates a Cohort from the audience.who answer and maps subsequent audience answers onto the same cohort", async () => {
    const session = await startOrResumeGuidedSetup({ clientId, organizationId: orgId, userId });
    await submitAnswer({
      sessionId: session.id,
      clientId,
      organizationId: orgId,
      userId,
      questionKey: "audience.who",
      value: "Marketing managers blamed for weak sales conversion",
    });
    const cohort = await prisma.cohort.findFirstOrThrow({ where: { clientId, name: "Marketing managers blamed for weak sales conversion" } });

    await submitAnswer({ sessionId: session.id, clientId, organizationId: orgId, userId, questionKey: "audience.role", value: "Marketing Manager" });
    const updated = await prisma.cohort.findUniqueOrThrow({ where: { id: cohort.id } });
    expect(updated.role).toBe("Marketing Manager");
    expect(updated.currentVersionNumber).toBe(2); // version bump on the second write, not a duplicate cohort
  });

  it("marks skipped questions without writing anything to a destination entity", async () => {
    const session = await startOrResumeGuidedSetup({ clientId, organizationId: orgId, userId });
    const cohortCountBefore = await prisma.cohort.count({ where: { clientId } });

    const { skipQuestion } = await import("@/server/services/guidedAnswer.service");
    await skipQuestion({ sessionId: session.id, clientId, questionKey: "audience.exact_language", reason: "DONT_KNOW" });

    const cohortCountAfter = await prisma.cohort.count({ where: { clientId } });
    expect(cohortCountAfter).toBe(cohortCountBefore);

    const answer = await prisma.guidedSetupAnswer.findUniqueOrThrow({
      where: { sessionId_questionKey: { sessionId: session.id, questionKey: "audience.exact_language" } },
    });
    expect(answer.approvalStatus).toBe("DRAFT");
  });
});

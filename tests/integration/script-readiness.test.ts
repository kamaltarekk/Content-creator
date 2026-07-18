import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { getScriptReadiness } from "@/server/services/scriptReadiness.service";
import { getNextBestAction } from "@/server/services/nextBestAction.service";

/**
 * Exercises the real readiness + Next Best Action services against a client
 * built up progressively from nothing -> educational-ready -> commercial-
 * ready, plus the conflict short-circuit, mirroring the guided-setup.test.ts
 * RUN_ID isolation pattern.
 */

const RUN_ID = `readiness-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let userId: string;
let clientId: string;
let cohortId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `ReadinessOrg ${RUN_ID}`, slug: `readiness-org-${RUN_ID}` } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { name: "Readiness User", email: `readiness-${RUN_ID}@test`, passwordHash: "x" } });
  userId = user.id;
  const client = await prisma.client.create({
    data: { organizationId: orgId, name: `ReadinessClient ${RUN_ID}`, displayName: "Readiness Client", brandType: "PERSONAL_BRAND" },
  });
  clientId = client.id;
});

afterAll(async () => {
  await prisma.conflict.deleteMany({ where: { clientId } });
  await prisma.extractedItem.deleteMany({ where: { source: { clientId } } });
  await prisma.sourceBlock.deleteMany({ where: { source: { clientId } } });
  await prisma.sourceVersion.deleteMany({ where: { source: { clientId } } });
  await prisma.source.deleteMany({ where: { clientId } });
  await prisma.clientBrainItemVersion.deleteMany({ where: { item: { clientId } } });
  await prisma.clientBrainItem.deleteMany({ where: { clientId } });
  await prisma.scriptIntelligenceField.deleteMany({ where: { clientId } });
  await prisma.proofItem.deleteMany({ where: { clientId } });
  await prisma.offer.deleteMany({ where: { clientId } });
  await prisma.beliefMap.deleteMany({ where: { clientId } });
  await prisma.commercialSituation.deleteMany({ where: { clientId } });
  await prisma.cohort.deleteMany({ where: { clientId } });
  await prisma.guidedSetupSession.deleteMany({ where: { clientId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.client.delete({ where: { id: clientId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.organization.delete({ where: { id: orgId } });
});

describe("getScriptReadiness + getNextBestAction (integration)", () => {
  it("reports MISSING readiness and points at guided setup when nothing exists yet", async () => {
    const readiness = await getScriptReadiness(clientId);
    expect(readiness.readyForEducational).toBe(false);

    const nextBestAction = await getNextBestAction(clientId);
    expect(nextBestAction.href).toBe(`/c/${clientId}/setup`);
    expect(nextBestAction.actionLabel).toBe("Start guided setup");
  });

  it("becomes ready for educational Reels (but not commercial) once the ANY-reel minimum is approved", async () => {
    await prisma.clientBrainItem.create({
      data: {
        clientId,
        sectionKey: "BUSINESS",
        fieldKey: "PRODUCTS_SERVICES",
        valueText: "1:1 marketing strategy consulting.",
        status: "ACTIVE",
        currentVersionNumber: 1,
        createdById: userId,
      },
    });
    await prisma.clientBrainItem.create({
      data: {
        clientId,
        sectionKey: "VOICE",
        fieldKey: "LANGUAGE",
        valueText: "English",
        status: "ACTIVE",
        currentVersionNumber: 1,
        createdById: userId,
      },
    });
    await prisma.clientBrainItem.create({
      data: {
        clientId,
        sectionKey: "VOICE",
        fieldKey: "TONE",
        valueText: "Direct, no-nonsense",
        status: "ACTIVE",
        currentVersionNumber: 1,
        createdById: userId,
      },
    });
    await prisma.scriptIntelligenceField.create({
      data: { clientId, sourceEntityType: "GuidedSetupAnswer", sourceEntityId: "seed", fieldKey: "content_objective", normalizedValue: "EDUCATION", approvalStatus: "APPROVED" },
    });

    const cohort = await prisma.cohort.create({
      data: { clientId, name: "Marketing managers", approvalStatus: "APPROVED", createdById: userId },
    });
    cohortId = cohort.id;

    await prisma.commercialSituation.create({
      data: {
        clientId,
        cohortId,
        title: "Weak conversion",
        triggerType: "PERFORMANCE_CHANGE",
        activeProblem: "Leads aren't converting to bookings.",
        approvalStatus: "APPROVED",
        createdById: userId,
      },
    });

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

    await prisma.guidedSetupSession.create({
      data: { clientId, userId, status: "COMPLETED", completedAt: new Date(0) },
    });

    const readiness = await getScriptReadiness(clientId);
    expect(readiness.readyForEducational).toBe(true);
    expect(readiness.readyForCommercial).toBe(false);
    expect(readiness.statements).toContain("Ready to create educational Reels.");

    const nextBestAction = await getNextBestAction(clientId);
    expect(nextBestAction.href).toBe(`/c/${clientId}/reels/new`);
    expect(nextBestAction.actionLabel).toBe("Create first Reel");
  });

  it("becomes ready for commercial Reels once an approved offer, CTA, and proof exist", async () => {
    await prisma.offer.create({
      data: {
        clientId,
        name: "Strategy Sprint",
        corePromise: "A focused plan to fix your conversion funnel.",
        ctaRoute: "Book a call",
        approvalStatus: "APPROVED",
        createdById: userId,
      },
    });
    await prisma.proofItem.create({
      data: {
        clientId,
        proofType: "CASE_STUDY",
        whatHappened: "A client doubled booked calls in 60 days.",
        publicUseStatus: "PUBLIC",
        approvalStatus: "APPROVED",
        needsReview: false,
        createdById: userId,
      },
    });

    const readiness = await getScriptReadiness(clientId);
    expect(readiness.readyForCommercial).toBe(true);
    expect(readiness.statements).toEqual(["Ready to create educational Reels.", "Ready to create commercial Reels."]);
  });

  it("puts conflict resolution ahead of every other Next Best Action", async () => {
    const item = await prisma.clientBrainItem.findFirstOrThrow({ where: { clientId, sectionKey: "BUSINESS" } });

    const source = await prisma.source.create({
      data: {
        clientId,
        fileName: "s.csv",
        originalFileName: "s.csv",
        fileType: "CSV",
        mimeType: "text/csv",
        sizeBytes: 10,
        checksumSha256: `c-${RUN_ID}`,
        storageKey: `k-${RUN_ID}`,
        sourceCategory: "STRATEGIC_FRAMEWORK",
        uploadedById: userId,
        processingStatus: "READY_FOR_REVIEW",
      },
    });
    const version = await prisma.sourceVersion.create({
      data: { sourceId: source.id, versionNumber: 1, storageKey: source.storageKey, checksumSha256: source.checksumSha256, sizeBytes: 10, uploadedById: userId },
    });
    const block = await prisma.sourceBlock.create({
      data: {
        sourceId: source.id,
        sourceVersionId: version.id,
        blockType: "TABLE_ROW",
        sequenceIndex: 0,
        rawText: "We also offer a different service entirely.",
        locationLabel: "Row 1",
        locationJson: { type: "csv_row", row: 1, headers: ["section", "note"] },
      },
    });
    const extractedItem = await prisma.extractedItem.create({
      data: {
        sourceBlockId: block.id,
        sourceId: source.id,
        informationType: "STRATEGIC_FACT",
        proposedSectionKey: "BUSINESS",
        proposedFieldKey: "PRODUCTS_SERVICES",
        normalizedValueText: "A different offering entirely.",
        confidence: 0.5,
        validationStatus: "VALID",
      },
    });
    await prisma.conflict.create({
      data: {
        clientId,
        clientBrainItemId: item.id,
        extractedItemId: extractedItem.id,
        detectedReason: "Conflicting value for the same field.",
        status: "OPEN",
      },
    });

    const nextBestAction = await getNextBestAction(clientId);
    expect(nextBestAction.href).toBe(`/c/${clientId}/brain/conflicts`);
    expect(nextBestAction.actionLabel).toBe("Review conflicts");
  });
});

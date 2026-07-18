import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { resolveReview } from "@/server/services/import.service";
import { applyApproval } from "@/server/services/clientBrain.service";

const RUN_ID = `rev-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let userId: string;
let clientId: string;
let sourceId: string;
let blockId: string;

async function seedBase() {
  const org = await prisma.organization.create({
    data: { name: `RevOrg ${RUN_ID}`, slug: `rev-org-${RUN_ID}` },
  });
  orgId = org.id;
  const user = await prisma.user.create({
    data: { name: "Reviewer", email: `rev-${RUN_ID}@test`, passwordHash: "x" },
  });
  userId = user.id;
  const client = await prisma.client.create({
    data: { organizationId: orgId, name: `RevClient ${RUN_ID}`, displayName: "Rev Client", brandType: "PERSONAL_BRAND" },
  });
  clientId = client.id;
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
  sourceId = source.id;
  const version = await prisma.sourceVersion.create({
    data: { sourceId, versionNumber: 1, storageKey: source.storageKey, checksumSha256: source.checksumSha256, sizeBytes: 10, uploadedById: userId },
  });
  const block = await prisma.sourceBlock.create({
    data: {
      sourceId,
      sourceVersionId: version.id,
      blockType: "TABLE_ROW",
      sequenceIndex: 0,
      rawText: "Offer: CEO Marketing Decision Session priced at 45,000 EGP.",
      locationLabel: "Row 8",
      locationJson: { type: "csv_row", row: 8, headers: ["section", "note"] },
    },
  });
  blockId = block.id;
}

async function makeExtractedItem(value: string) {
  const extracted = await prisma.extractedItem.create({
    data: {
      sourceBlockId: blockId,
      sourceId,
      informationType: "STRATEGIC_FACT",
      proposedSectionKey: "OFFERS",
      proposedFieldKey: "PRICE",
      normalizedValueText: value,
      confidence: 0.9,
      detectedLanguage: "en",
      reasoningSummary: "Stated offer price.",
      suggestedTags: ["offer"],
      isConflictCandidate: false,
      validationStatus: "VALID",
    },
  });
  const review = await prisma.importReview.create({
    data: { extractedItemId: extracted.id, clientId, status: "PENDING" },
  });
  return { extracted, review };
}

async function cleanup() {
  await prisma.conflictResolution.deleteMany({ where: { conflict: { clientId } } });
  await prisma.conflict.deleteMany({ where: { clientId } });
  await prisma.clientBrainItemSource.deleteMany({ where: { item: { clientId } } });
  await prisma.clientBrainItemVersion.deleteMany({ where: { item: { clientId } } });
  await prisma.clientBrainItem.deleteMany({ where: { clientId } });
  await prisma.importReview.deleteMany({ where: { clientId } });
  await prisma.extractedItem.deleteMany({ where: { sourceId } });
  await prisma.auditLog.deleteMany({ where: { clientId } });
  await prisma.sourceBlock.deleteMany({ where: { sourceId } });
  await prisma.sourceVersion.deleteMany({ where: { sourceId } });
  await prisma.source.deleteMany({ where: { clientId } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
}

beforeEach(async () => {
  await seedBase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("review approval → Client Brain", () => {
  it("approving creates an ACTIVE brain item with a version and a source trace", async () => {
    const { extracted, review } = await makeExtractedItem("45,000 EGP");
    const result = await resolveReview({
      reviewId: review.id,
      action: "APPROVE",
      reviewerId: userId,
      organizationId: orgId,
    });

    expect(result.approval?.status).toBe("created");

    const brainItems = await prisma.clientBrainItem.findMany({
      where: { clientId },
      include: { versions: true, sourceLinks: true },
    });
    expect(brainItems).toHaveLength(1);
    const item = brainItems[0];
    expect(item.status).toBe("ACTIVE");
    expect(item.sectionKey).toBe("OFFERS");
    expect(item.fieldKey).toBe("PRICE");
    expect(item.versions).toHaveLength(1);
    expect(item.versions[0].changeType).toBe("ADDED");

    // Source traceability: links back to the exact source block + extracted item + approver.
    expect(item.sourceLinks).toHaveLength(1);
    expect(item.sourceLinks[0].sourceId).toBe(sourceId);
    expect(item.sourceLinks[0].sourceBlockId).toBe(blockId);
    expect(item.sourceLinks[0].extractedItemId).toBe(extracted.id);
    expect(item.sourceLinks[0].approvedById).toBe(userId);

    const resolved = await prisma.importReview.findUniqueOrThrow({ where: { id: review.id } });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolutionAction).toBe("APPROVE");

    await cleanup();
  });

  it("rejecting resolves the review without writing to the Client Brain", async () => {
    const { review } = await makeExtractedItem("45,000 EGP");
    await resolveReview({ reviewId: review.id, action: "REJECT", reviewerId: userId, organizationId: orgId });

    expect(await prisma.clientBrainItem.count({ where: { clientId } })).toBe(0);
    const resolved = await prisma.importReview.findUniqueOrThrow({ where: { id: review.id } });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolutionAction).toBe("REJECT");

    await cleanup();
  });

  it("a conflicting approval opens a Conflict and never overwrites the existing value", async () => {
    // First approve 45,000.
    const first = await makeExtractedItem("45,000 EGP");
    await resolveReview({ reviewId: first.review.id, action: "APPROVE", reviewerId: userId, organizationId: orgId });

    // Now approve a materially different price for the same field.
    const second = await makeExtractedItem("30,000 EGP");
    const result = await resolveReview({
      reviewId: second.review.id,
      action: "APPROVE",
      reviewerId: userId,
      organizationId: orgId,
    });

    expect(result.approval?.status).toBe("conflict");

    // The existing brain item keeps its original value and is marked DISPUTED.
    const item = await prisma.clientBrainItem.findFirstOrThrow({ where: { clientId, fieldKey: "PRICE" } });
    expect(item.valueText).toBe("45,000 EGP");
    expect(item.status).toBe("DISPUTED");

    // A Conflict was opened; the second review stays PENDING until it's resolved.
    const conflicts = await prisma.conflict.findMany({ where: { clientId, status: "OPEN" } });
    expect(conflicts).toHaveLength(1);
    const stillPending = await prisma.importReview.findUniqueOrThrow({ where: { id: second.review.id } });
    expect(stillPending.status).toBe("PENDING");

    await cleanup();
  });

  it("applyApproval updates a non-conflicting reworded value with a new version", async () => {
    const first = await makeExtractedItem("The category is commercial marketing belief reframing.");
    // Re-point to a free-text field to exercise the text-similarity path.
    await prisma.extractedItem.update({
      where: { id: first.extracted.id },
      data: { proposedSectionKey: "POSITIONING", proposedFieldKey: "CATEGORY" },
    });
    await resolveReview({ reviewId: first.review.id, action: "APPROVE", reviewerId: userId, organizationId: orgId });

    const second = await makeExtractedItem("The category is commercial marketing belief reframing for CEOs.");
    await prisma.extractedItem.update({
      where: { id: second.extracted.id },
      data: { proposedSectionKey: "POSITIONING", proposedFieldKey: "CATEGORY" },
    });
    const result = await applyApproval({
      extractedItemId: second.extracted.id,
      reviewerId: userId,
      organizationId: orgId,
      sectionKey: "POSITIONING",
      fieldKey: "CATEGORY",
      valueText: "The category is commercial marketing belief reframing for CEOs.",
      informationType: "STRATEGIC_FACT",
      confidence: 0.9,
    });

    // Slightly reworded but similar → updated, not a conflict.
    expect(result.status).toBe("updated");
    const item = await prisma.clientBrainItem.findFirstOrThrow({ where: { clientId, fieldKey: "CATEGORY" } });
    expect(item.currentVersionNumber).toBe(2);

    await cleanup();
  });
});

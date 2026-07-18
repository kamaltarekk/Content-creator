import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { resolveReview } from "@/server/services/import.service";
import { resolveConflict } from "@/server/services/conflict.service";

const RUN_ID = `cfl-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let userId: string;
let clientId: string;
let sourceId: string;
let blockId: string;

async function seedBase() {
  const org = await prisma.organization.create({ data: { name: `CflOrg ${RUN_ID}`, slug: `cfl-org-${RUN_ID}` } });
  orgId = org.id;
  const user = await prisma.user.create({ data: { name: "Res", email: `cfl-${RUN_ID}@test`, passwordHash: "x" } });
  userId = user.id;
  const client = await prisma.client.create({
    data: { organizationId: orgId, name: `CflClient ${RUN_ID}`, displayName: "Cfl", brandType: "PERSONAL_BRAND" },
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
      rawText: "Offer price",
      locationLabel: "Row 8",
      locationJson: { type: "csv_row", row: 8, headers: [] },
    },
  });
  blockId = block.id;
}

async function makeReview(value: string) {
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
      suggestedTags: [],
      validationStatus: "VALID",
    },
  });
  return prisma.importReview.create({ data: { extractedItemId: extracted.id, clientId, status: "PENDING" } });
}

async function openPriceConflict() {
  const first = await makeReview("45,000 EGP");
  await resolveReview({ reviewId: first.id, action: "APPROVE", reviewerId: userId, organizationId: orgId });
  const second = await makeReview("30,000 EGP");
  await resolveReview({ reviewId: second.id, action: "APPROVE", reviewerId: userId, organizationId: orgId });
  const conflict = await prisma.conflict.findFirstOrThrow({ where: { clientId, status: "OPEN" } });
  return conflict.id;
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

describe("conflict resolution", () => {
  it("KEEP_EXISTING keeps the original value and reactivates the item", async () => {
    const conflictId = await openPriceConflict();
    await resolveConflict({ conflictId, resolutionType: "KEEP_EXISTING", reviewerId: userId, organizationId: orgId });

    const item = await prisma.clientBrainItem.findFirstOrThrow({ where: { clientId, fieldKey: "PRICE" } });
    expect(item.valueText).toBe("45,000 EGP");
    expect(item.status).toBe("ACTIVE");
    const conflict = await prisma.conflict.findUniqueOrThrow({ where: { id: conflictId } });
    expect(conflict.status).toBe("RESOLVED");

    await cleanup();
  });

  it("REPLACE adopts the new value as a new version with a fresh source trace", async () => {
    const conflictId = await openPriceConflict();
    await resolveConflict({ conflictId, resolutionType: "REPLACE", reviewerId: userId, organizationId: orgId });

    const item = await prisma.clientBrainItem.findFirstOrThrow({
      where: { clientId, fieldKey: "PRICE" },
      include: { versions: true, sourceLinks: true },
    });
    expect(item.valueText).toBe("30,000 EGP");
    expect(item.status).toBe("ACTIVE");
    expect(item.currentVersionNumber).toBe(2);
    expect(item.sourceLinks.length).toBeGreaterThanOrEqual(2);

    await cleanup();
  });

  it("STORE_BOTH keeps the existing item and adds a second context-specific one", async () => {
    const conflictId = await openPriceConflict();
    await resolveConflict({ conflictId, resolutionType: "STORE_BOTH", reviewerId: userId, organizationId: orgId });

    const items = await prisma.clientBrainItem.findMany({ where: { clientId, fieldKey: "PRICE" } });
    expect(items).toHaveLength(2);
    const values = items.map((i) => i.valueText).sort();
    expect(values).toEqual(["30,000 EGP", "45,000 EGP"]);
    expect(items.every((i) => i.status === "ACTIVE")).toBe(true);

    await cleanup();
  });

  it("MARK_UNRESOLVED leaves the conflict open and the item disputed", async () => {
    const conflictId = await openPriceConflict();
    await resolveConflict({ conflictId, resolutionType: "MARK_UNRESOLVED", reviewerId: userId, organizationId: orgId });

    const conflict = await prisma.conflict.findUniqueOrThrow({ where: { id: conflictId } });
    expect(conflict.status).toBe("OPEN");
    const item = await prisma.clientBrainItem.findFirstOrThrow({ where: { clientId, fieldKey: "PRICE" } });
    expect(item.status).toBe("DISPUTED");
    // The decision itself is still recorded.
    const resolutions = await prisma.conflictResolution.findMany({ where: { conflictId } });
    expect(resolutions).toHaveLength(1);

    await cleanup();
  });
});

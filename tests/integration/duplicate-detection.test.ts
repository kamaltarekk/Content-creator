import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { validateSourceExtraction } from "@/server/services/validation.service";

const RUN_ID = `dup-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let clientId: string;
let sourceId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `DupOrg ${RUN_ID}`, slug: `dup-org-${RUN_ID}` } });
  orgId = org.id;
  const client = await prisma.client.create({
    data: { organizationId: orgId, name: `DupClient ${RUN_ID}`, displayName: "Dup", brandType: "PERSONAL_BRAND" },
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
      uploadedById: "seed",
      processingStatus: "PROCESSING",
    },
  });
  sourceId = source.id;
  const version = await prisma.sourceVersion.create({
    data: { sourceId, versionNumber: 1, storageKey: source.storageKey, checksumSha256: source.checksumSha256, sizeBytes: 10, uploadedById: "seed" },
  });

  async function block(seq: number) {
    return prisma.sourceBlock.create({
      data: {
        sourceId,
        sourceVersionId: version.id,
        blockType: "TABLE_ROW",
        sequenceIndex: seq,
        rawText: `row ${seq}`,
        locationLabel: `Row ${seq}`,
        locationJson: { type: "csv_row", row: seq, headers: [] },
      },
    });
  }

  // Two items with the same normalized value on the same field (duplicates),
  // one low-confidence item, and one distinct item.
  const b1 = await block(1);
  const b2 = await block(2);
  const b3 = await block(3);
  const b4 = await block(4);

  await prisma.extractedItem.createMany({
    data: [
      {
        sourceBlockId: b1.id,
        sourceId,
        informationType: "STRATEGIC_FACT",
        proposedSectionKey: "POSITIONING",
        proposedFieldKey: "CATEGORY",
        normalizedValueText: "Commercial Marketing Belief Reframer",
        confidence: 0.9,
        suggestedTags: [],
        validationStatus: "PENDING",
      },
      {
        sourceBlockId: b2.id,
        sourceId,
        informationType: "STRATEGIC_FACT",
        proposedSectionKey: "POSITIONING",
        proposedFieldKey: "CATEGORY",
        normalizedValueText: "commercial marketing belief reframer.", // same after normalization
        confidence: 0.85,
        suggestedTags: [],
        validationStatus: "PENDING",
      },
      {
        sourceBlockId: b3.id,
        sourceId,
        informationType: "HYPOTHESIS",
        proposedSectionKey: "POSITIONING",
        proposedFieldKey: "POINT_OF_VIEW",
        normalizedValueText: "Maybe something uncertain",
        confidence: 0.3, // low confidence
        suggestedTags: [],
        validationStatus: "PENDING",
      },
      {
        sourceBlockId: b4.id,
        sourceId,
        informationType: "STRATEGIC_FACT",
        proposedSectionKey: "OFFERS",
        proposedFieldKey: "PRICE",
        normalizedValueText: "45,000 EGP",
        confidence: 0.9,
        suggestedTags: [],
        validationStatus: "PENDING",
      },
    ],
  });
});

afterAll(async () => {
  await prisma.extractedItem.deleteMany({ where: { sourceId } });
  await prisma.sourceBlock.deleteMany({ where: { sourceId } });
  await prisma.sourceVersion.deleteMany({ where: { sourceId } });
  await prisma.source.deleteMany({ where: { clientId } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe("validateSourceExtraction", () => {
  it("detects the exact duplicate, flags low confidence, and marks items valid", async () => {
    const summary = await validateSourceExtraction(sourceId);

    expect(summary.duplicateCount).toBe(1);
    expect(summary.lowConfidenceCount).toBe(1);
    expect(summary.validCount).toBe(4);

    const items = await prisma.extractedItem.findMany({
      where: { sourceId },
      orderBy: { createdAt: "asc" },
    });

    // The second "reframer" item is linked as a duplicate of the first.
    const duplicate = items.find((i) => i.duplicateOfItemId !== null);
    expect(duplicate).toBeTruthy();
    expect(duplicate?.validationNotes).toContain("duplicate");

    // The low-confidence hypothesis is annotated.
    const lowConf = items.find((i) => i.confidence < 0.55);
    expect(lowConf?.validationNotes).toContain("Low confidence");
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { classifySourceBlocks } from "@/server/services/classification.service";
import type { AIProvider, ClassificationResult, ClassifyBlockInput } from "@/server/providers/ai/ai.provider";
import type { StrategySuggestionResult, SuggestStrategyInput } from "@/server/domain/strategy-suggestion";
import type { GuidedAnswerSuggestionResult, SuggestGuidedAnswerInput } from "@/server/domain/guided-answer-suggestion";

/**
 * A deterministic fake AIProvider so the classification pipeline can be
 * exercised without a live model. It mirrors the real contract: returns
 * ClassificationSchema-shaped results based on the block text.
 */
class FakeAIProvider implements AIProvider {
  async classifyBlock(input: ClassifyBlockInput): Promise<ClassificationResult> {
    if (input.blockText.toLowerCase().includes("high roas")) {
      return {
        information_type: "STRATEGIC_FACT",
        proposed_destination: "BELIEFS",
        proposed_field: "WRONG_BELIEF",
        normalized_value: "High ROAS means marketing success.",
        confidence: 0.82,
        detected_language: "en",
        is_conflict_candidate: false,
        reasoning_summary: "States a marketing belief the client challenges.",
        suggested_tags: ["belief"],
      };
    }
    return {
      information_type: "RAW_NOTE",
      proposed_destination: null,
      proposed_field: null,
      normalized_value: input.blockText.slice(0, 200),
      confidence: 0.4,
      detected_language: "en",
      is_conflict_candidate: false,
      reasoning_summary: "Unclassified note.",
      suggested_tags: [],
    };
  }

  async suggestStrategy(input: SuggestStrategyInput): Promise<StrategySuggestionResult> {
    return {
      suggestion_type: input.targetType,
      title: "Fake suggestion",
      proposed_fields: { name: "Fake cohort" },
      source_references: [],
      confidence: 0.5,
      reasoning_summary: "Fake provider stub.",
      missing_evidence: [],
      possible_conflicts: [],
      suggested_relationships: [],
    };
  }

  async suggestGuidedAnswer(input: SuggestGuidedAnswerInput): Promise<GuidedAnswerSuggestionResult> {
    throw new Error(`suggestGuidedAnswer is not used in this test (question: ${input.question.slice(0, 10)})`);
  }
}

const RUN_ID = `itg-${process.pid}-${process.hrtime()[1]}`;
let orgId: string;
let clientId: string;
let sourceId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { name: `Test Org ${RUN_ID}`, slug: `test-org-${RUN_ID}` },
  });
  orgId = org.id;

  const client = await prisma.client.create({
    data: {
      organizationId: orgId,
      name: `Test Client ${RUN_ID}`,
      displayName: "Test Client",
      brandType: "PERSONAL_BRAND",
    },
  });
  clientId = client.id;

  const source = await prisma.source.create({
    data: {
      clientId,
      fileName: "t.csv",
      originalFileName: "t.csv",
      fileType: "CSV",
      mimeType: "text/csv",
      sizeBytes: 10,
      checksumSha256: `sum-${RUN_ID}`,
      storageKey: `k-${RUN_ID}`,
      sourceCategory: "STRATEGIC_FRAMEWORK",
      uploadedById: "seed-user",
      processingStatus: "PROCESSING",
    },
  });
  sourceId = source.id;

  const version = await prisma.sourceVersion.create({
    data: {
      sourceId,
      versionNumber: 1,
      storageKey: source.storageKey,
      checksumSha256: source.checksumSha256,
      sizeBytes: 10,
      uploadedById: "seed-user",
    },
  });

  await prisma.sourceBlock.createMany({
    data: [
      {
        sourceId,
        sourceVersionId: version.id,
        blockType: "TABLE_ROW",
        sequenceIndex: 0,
        rawText: "Wrong belief: High ROAS means marketing success.",
        locationLabel: "Row 2",
        locationJson: { type: "csv_row", row: 2, headers: ["section", "note"] },
      },
      {
        sourceId,
        sourceVersionId: version.id,
        blockType: "TABLE_ROW",
        sequenceIndex: 1,
        rawText: "Some incidental note.",
        locationLabel: "Row 3",
        locationJson: { type: "csv_row", row: 3, headers: ["section", "note"] },
      },
    ],
  });
});

afterAll(async () => {
  await prisma.importReview.deleteMany({ where: { clientId } });
  await prisma.extractedItem.deleteMany({ where: { sourceId } });
  await prisma.sourceBlock.deleteMany({ where: { sourceId } });
  await prisma.sourceVersion.deleteMany({ where: { sourceId } });
  await prisma.source.deleteMany({ where: { clientId } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe("classifySourceBlocks", () => {
  it("creates an ExtractedItem + PENDING ImportReview per block and preserves source trace", async () => {
    const summary = await classifySourceBlocks(sourceId, new FakeAIProvider());

    expect(summary.classifiedCount).toBe(2);
    expect(summary.skippedCount).toBe(0);

    const items = await prisma.extractedItem.findMany({
      where: { sourceId },
      include: { sourceBlock: true, review: true },
      orderBy: { sourceBlock: { sequenceIndex: "asc" } },
    });
    expect(items).toHaveLength(2);

    // Each extracted item links back to a real source block (traceability).
    for (const item of items) {
      expect(item.sourceBlock).toBeTruthy();
      expect(item.review?.status).toBe("PENDING");
    }

    // The belief block was classified into a valid destination and marked VALID.
    const belief = items.find((i) => i.proposedFieldKey === "WRONG_BELIEF");
    expect(belief).toBeTruthy();
    expect(belief?.proposedSectionKey).toBe("BELIEFS");
    expect(belief?.validationStatus).toBe("VALID");

    // The low-confidence raw note is flagged by the deterministic validation pass.
    const note = items.find((i) => i.informationType === "RAW_NOTE");
    expect(note?.validationNotes).toContain("Low confidence");
  });

  it("is idempotent — re-running does not double-create items", async () => {
    const summary = await classifySourceBlocks(sourceId, new FakeAIProvider());
    expect(summary.classifiedCount).toBe(0);

    const count = await prisma.extractedItem.count({ where: { sourceId } });
    expect(count).toBe(2);
  });
});

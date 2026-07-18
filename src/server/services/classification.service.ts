import "server-only";

import pLimit from "p-limit";
import type { SourceBlock } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { getAIProvider } from "@/server/providers/ai/openai.provider";
import type { AIProvider } from "@/server/providers/ai/ai.provider";
import { SECTION_LABELS } from "@/server/domain/brain-schema";
import { validateSourceExtraction } from "@/server/services/validation.service";

const CONCURRENCY = 4;

export type ClassificationSummary = {
  classifiedCount: number;
  skippedCount: number;
};

/** A short digest of the client's current ACTIVE brain, given to the model for conflict awareness. */
async function buildBrainDigest(clientId: string): Promise<string> {
  const items = await prisma.clientBrainItem.findMany({
    where: { clientId, status: "ACTIVE" },
    select: { sectionKey: true, fieldKey: true, valueText: true },
    take: 40,
  });
  if (items.length === 0) return "";
  return items
    .map((item) => `${SECTION_LABELS[item.sectionKey]}/${item.fieldKey}: ${(item.valueText ?? "").slice(0, 120)}`)
    .join(" | ");
}

/**
 * Classifies every not-yet-classified block of a source into a proposed
 * Client Brain destination, creating an ExtractedItem + a PENDING
 * ImportReview for each. Nothing is written to the Client Brain — every
 * result waits for human review. Per-block failures are tolerated (the block
 * is simply left unclassified) so one bad block never fails the whole source.
 */
export async function classifySourceBlocks(
  sourceId: string,
  provider: AIProvider = getAIProvider(),
): Promise<ClassificationSummary> {
  const source = await prisma.source.findUniqueOrThrow({
    where: { id: sourceId },
    include: { client: true },
  });

  const alreadyClassified = await prisma.extractedItem.findMany({
    where: { sourceId },
    select: { sourceBlockId: true },
  });
  const classifiedBlockIds = new Set(alreadyClassified.map((item) => item.sourceBlockId));

  const blocks = await prisma.sourceBlock.findMany({
    where: { sourceId },
    orderBy: { sequenceIndex: "asc" },
  });
  const pending = blocks.filter((block) => !classifiedBlockIds.has(block.id));

  if (pending.length === 0) {
    return { classifiedCount: 0, skippedCount: 0 };
  }

  const digest = await buildBrainDigest(source.clientId);
  const limit = pLimit(CONCURRENCY);

  let classifiedCount = 0;
  let skippedCount = 0;

  await Promise.all(
    pending.map((block: SourceBlock) =>
      limit(async () => {
        try {
          const result = await provider.classifyBlock({
            blockText: block.rawText,
            blockType: block.blockType,
            locationLabel: block.locationLabel,
            sourceCategory: source.sourceCategory,
            clientContext: {
              clientName: source.client.displayName,
              brandType: source.client.brandType,
              existingBrainDigest: digest,
            },
          });

          const extracted = await prisma.extractedItem.create({
            data: {
              sourceBlockId: block.id,
              sourceId,
              informationType: result.information_type,
              proposedSectionKey: result.proposed_destination,
              proposedFieldKey: result.proposed_field,
              normalizedValueText: result.normalized_value,
              confidence: result.confidence,
              detectedLanguage: result.detected_language,
              reasoningSummary: result.reasoning_summary,
              suggestedTags: result.suggested_tags,
              isConflictCandidate: result.is_conflict_candidate,
              aiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
              validationStatus: "PENDING",
            },
          });

          await prisma.importReview.create({
            data: { extractedItemId: extracted.id, clientId: source.clientId, status: "PENDING" },
          });

          classifiedCount += 1;
        } catch (error) {
          skippedCount += 1;
          console.error(`[classification] block ${block.id} skipped: ${(error as Error).message}`);
        }
      }),
    ),
  );

  if (classifiedCount > 0) {
    await validateSourceExtraction(sourceId);
  }

  return { classifiedCount, skippedCount };
}

import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { storageProvider } from "@/server/providers/storage/local.storage.provider";
import { extractSource } from "@/server/extraction/dispatcher";
import type { ExtractionResult } from "@/server/extraction/types";

export type ExtractionOutcome = {
  result: ExtractionResult;
  blockCount: number;
};

/**
 * Reads a source's stored original, runs the right extractor, and persists
 * the resulting blocks as SourceBlock rows (each carrying its exact source
 * location). Returns the outcome so the job handler can drive the source's
 * processing status. Does NOT classify — classification is a separate step
 * (classificationService) run by the job handler after this.
 */
export async function extractAndPersistBlocks(sourceId: string): Promise<ExtractionOutcome> {
  const source = await prisma.source.findUniqueOrThrow({ where: { id: sourceId } });
  const version = await prisma.sourceVersion.findFirstOrThrow({
    where: { sourceId, versionNumber: source.currentVersionNumber },
  });

  const buffer = await storageProvider.read(source.storageKey);

  const result = await extractSource(source.fileType, {
    buffer,
    fileName: source.fileName,
    mimeType: source.mimeType,
    storageKey: source.storageKey,
  });

  if (result.status === "unsupported") {
    return { result, blockCount: 0 };
  }

  const blocks = result.blocks;
  if (blocks.length === 0) {
    return { result, blockCount: 0 };
  }

  // Replace any prior blocks for this version (idempotent re-processing).
  await prisma.$transaction(async (tx) => {
    await tx.sourceBlock.deleteMany({ where: { sourceId, sourceVersionId: version.id } });
    await tx.sourceBlock.createMany({
      data: blocks.map((block, sequenceIndex) => ({
        sourceId,
        sourceVersionId: version.id,
        blockType: block.blockType,
        sequenceIndex,
        rawText: block.rawText,
        locationLabel: block.locationLabel,
        locationJson: block.location as unknown as Prisma.InputJsonValue,
      })),
    });
  });

  return { result, blockCount: blocks.length };
}

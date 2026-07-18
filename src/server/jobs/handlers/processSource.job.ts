import "server-only";

import type { SourceProcessingStatus } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import type { JobContext, JobHandler, JobPayloadMap } from "@/server/jobs/jobRunner";
import { extractAndPersistBlocks } from "@/server/services/extraction.service";

async function setStatus(sourceId: string, status: SourceProcessingStatus, requiresMultimodal?: boolean) {
  await prisma.source.update({
    where: { id: sourceId },
    data: {
      processingStatus: status,
      ...(requiresMultimodal !== undefined && { requiresMultimodal }),
    },
  });
}

/**
 * Processing pipeline for one source: extract text into location-preserving
 * blocks. AI classification (which turns blocks into reviewable ExtractedItems)
 * is layered on in the classification milestone; until then a source with
 * blocks is marked READY_FOR_REVIEW. Nothing here writes to the Client Brain.
 */
export const processSourceHandler: JobHandler<"PROCESS_SOURCE"> = {
  async handle(_payload: JobPayloadMap["PROCESS_SOURCE"], ctx: JobContext) {
    await setStatus(ctx.sourceId, "PROCESSING");

    const { result, blockCount } = await extractAndPersistBlocks(ctx.sourceId);

    if (result.status === "unsupported") {
      await setStatus(ctx.sourceId, "NEEDS_ATTENTION", true);
      return { summary: { blockCount: 0, reason: result.reason } };
    }

    if (blockCount === 0) {
      const reason = result.status === "needs_attention" ? result.reason : "No content extracted.";
      await setStatus(ctx.sourceId, "NEEDS_ATTENTION");
      return { summary: { blockCount: 0, reason } };
    }

    await setStatus(ctx.sourceId, "READY_FOR_REVIEW");
    return { summary: { blockCount } };
  },
};

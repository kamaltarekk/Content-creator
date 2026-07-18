import "server-only";

import type { SourceProcessingStatus } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import type { JobContext, JobHandler, JobPayloadMap } from "@/server/jobs/jobRunner";
import { extractAndPersistBlocks } from "@/server/services/extraction.service";
import { classifySourceBlocks } from "@/server/services/classification.service";

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
 * Full processing pipeline for one source: extract text into
 * location-preserving blocks, then classify each block into a proposed
 * Client Brain destination with a PENDING ImportReview attached. Nothing here
 * writes to the Client Brain — every result lands in the review queue for a
 * human to approve.
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

    const classification = await classifySourceBlocks(ctx.sourceId);

    // If no block could be classified (e.g. AI provider unavailable), the
    // source still needs a human look rather than a silently-empty queue.
    const finalStatus: SourceProcessingStatus =
      classification.classifiedCount === 0 ? "NEEDS_ATTENTION" : "READY_FOR_REVIEW";
    await setStatus(ctx.sourceId, finalStatus);

    return {
      summary: {
        blockCount,
        classifiedCount: classification.classifiedCount,
        skippedCount: classification.skippedCount,
      },
    };
  },
};

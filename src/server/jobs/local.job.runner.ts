import "server-only";

import type { Prisma, SourceProcessingJob } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import type { JobPayloadMap, JobRunner } from "@/server/jobs/jobRunner";
import { getHandler } from "@/server/jobs/registry";

const POLL_INTERVAL_MS = 2000;
const BACKOFF_BASE_MS = 5000;

/**
 * In-process job runner backed by the SourceProcessingJob table (so jobs
 * survive restarts). A ~2s loop claims one due PENDING row at a time using
 * `FOR UPDATE SKIP LOCKED`, which is safe even if several server instances
 * run the loop concurrently. Replace with BullMQ/Inngest by implementing the
 * JobRunner interface and dropping the loop.
 */
export class LocalJobRunner implements JobRunner {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  async enqueue<T extends keyof JobPayloadMap>(
    type: T,
    payload: JobPayloadMap[T],
  ): Promise<{ jobId: string }> {
    const job = await prisma.sourceProcessingJob.create({
      data: {
        sourceId: payload.sourceId,
        sourceVersionId: "sourceVersionId" in payload ? payload.sourceVersionId : null,
        jobType: type,
        status: "PENDING",
      },
    });
    return { jobId: job.id };
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    // Don't keep the event loop alive solely for polling.
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // Drain any due jobs this tick, one claim at a time.
      let claimed = await this.claimNextJob();
      while (claimed) {
        await this.runJob(claimed);
        claimed = await this.claimNextJob();
      }
    } catch (error) {
      console.error("[LocalJobRunner] tick error", error);
    } finally {
      this.running = false;
    }
  }

  private async claimNextJob(): Promise<SourceProcessingJob | null> {
    const rows = await prisma.$queryRaw<SourceProcessingJob[]>`
      UPDATE "SourceProcessingJob"
      SET status = 'RUNNING', "startedAt" = now(), "updatedAt" = now(), attempts = attempts + 1
      WHERE id = (
        SELECT id FROM "SourceProcessingJob"
        WHERE status = 'PENDING' AND "scheduledAt" <= now()
        ORDER BY "scheduledAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *;
    `;
    return rows[0] ?? null;
  }

  private async runJob(job: SourceProcessingJob): Promise<void> {
    const handler = getHandler(job.jobType);
    try {
      const { summary } = await handler.handle(
        { sourceId: job.sourceId, sourceVersionId: job.sourceVersionId ?? "" },
        { jobId: job.id, sourceId: job.sourceId },
      );
      await prisma.sourceProcessingJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED",
          finishedAt: new Date(),
          resultSummary: (summary ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetry = job.attempts < job.maxAttempts;
      if (shouldRetry) {
        await prisma.sourceProcessingJob.update({
          where: { id: job.id },
          data: {
            status: "PENDING",
            errorMessage: message,
            scheduledAt: new Date(Date.now() + BACKOFF_BASE_MS * job.attempts),
          },
        });
      } else {
        await prisma.sourceProcessingJob.update({
          where: { id: job.id },
          data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
        });
        await prisma.source.update({
          where: { id: job.sourceId },
          data: { processingStatus: "FAILED" },
        });
      }
      console.error(`[LocalJobRunner] job ${job.id} failed (attempt ${job.attempts}): ${message}`);
    }
  }
}

// Singleton across HMR reloads in dev.
const globalForJobs = globalThis as unknown as {
  jobRunner: LocalJobRunner | undefined;
  jobRunnerStarted: boolean | undefined;
};
export const jobRunner: LocalJobRunner = globalForJobs.jobRunner ?? new LocalJobRunner();
if (process.env.NODE_ENV !== "production") {
  globalForJobs.jobRunner = jobRunner;
}

/**
 * Starts the polling loop exactly once per process. Called lazily from
 * Node-only server contexts (server actions / route handlers) rather than
 * from instrumentation.ts — instrumentation is compiled for the Edge runtime
 * too (middleware exists), and webpack can't bundle this file's node: imports
 * for Edge. Lazy start keeps the whole worker graph in the Node runtime.
 */
export function ensureJobRunnerStarted(): void {
  if (globalForJobs.jobRunnerStarted) return;
  globalForJobs.jobRunnerStarted = true;
  jobRunner.start();
}

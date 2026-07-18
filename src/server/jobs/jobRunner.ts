import "server-only";

import type { JobType } from "@prisma/client";

export interface JobPayloadMap {
  PROCESS_SOURCE: { sourceId: string; sourceVersionId: string };
}

export interface JobContext {
  jobId: string;
  sourceId: string;
}

export interface JobHandler<T extends keyof JobPayloadMap> {
  handle(payload: JobPayloadMap[T], ctx: JobContext): Promise<{ summary?: Record<string, unknown> }>;
}

/**
 * Queue abstraction. LocalJobRunner (below) backs this with the
 * SourceProcessingJob table + an in-process polling loop. To move to
 * BullMQ / Inngest / Trigger.dev later, implement this same interface and
 * remove the polling loop from instrumentation.ts — nothing else changes.
 */
export interface JobRunner {
  enqueue<T extends keyof JobPayloadMap>(type: T, payload: JobPayloadMap[T]): Promise<{ jobId: string }>;
  start(): void;
  stop(): void;
}

export type JobTypeName = JobType;

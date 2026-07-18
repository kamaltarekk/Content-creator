import "server-only";

import type { JobType } from "@prisma/client";

import type { JobHandler, JobPayloadMap } from "@/server/jobs/jobRunner";
import { processSourceHandler } from "@/server/jobs/handlers/processSource.job";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- handlers are keyed by JobType but each has a distinct payload; the runner narrows per-type at dispatch.
export const JOB_REGISTRY: Record<JobType, JobHandler<any>> = {
  PROCESS_SOURCE: processSourceHandler,
};

export function getHandler(jobType: JobType): JobHandler<keyof JobPayloadMap> {
  return JOB_REGISTRY[jobType];
}

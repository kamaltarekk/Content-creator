import "server-only";

import { prisma } from "@/server/db/prisma";
import { plainLanguageSectionLabel } from "@/server/domain/brain-schema";
import { getCompletenessForClient } from "@/server/services/missingData.service";
import { getScriptReadiness } from "@/server/services/scriptReadiness.service";
import { getNextBestAction, type NextBestAction } from "@/server/services/nextBestAction.service";

export type { NextBestAction };

/**
 * Guided Mode never shows a percentage or a dense section list — only these
 * four states (spec: "only 4 visible states"). Internal completeness scoring
 * still exists underneath and remains visible in Expert Mode.
 */
export type BrainReadinessStatus = "READY" | "NEEDS_REVIEW" | "MISSING" | "CONFLICT";

export type GuidedBrainOverview = {
  clientName: string;
  status: BrainReadinessStatus;
  statusLabel: string;
  statusDescription: string;
  whatWeUnderstand: string[];
  whatWeStillNeed: string[];
  nextBestAction: NextBestAction;
};

const STATUS_LABEL: Record<BrainReadinessStatus, string> = {
  READY: "Ready",
  NEEDS_REVIEW: "Needs Review",
  MISSING: "Missing",
  CONFLICT: "Conflict",
};

/**
 * Computes the Guided Client Brain overview: a 4-state status derived from
 * the script readiness rules, a plain-language "what we understand" / "what
 * we still need" summary, and a single Next Best Action (spec sections 17,
 * 19, 20). The status description is a practical statement — "Ready to
 * create educational Reels", "Needs proof before using performance claims" —
 * never a bare percentage; the detailed completeness score stays in Expert
 * Mode via CompletenessPanel.
 */
export async function getGuidedBrainOverview(clientId: string): Promise<GuidedBrainOverview> {
  const [client, completeness, openConflicts, readiness, nextBestAction] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true } }),
    getCompletenessForClient(clientId),
    prisma.conflict.count({ where: { clientId, status: "OPEN" } }),
    getScriptReadiness(clientId),
    getNextBestAction(clientId),
  ]);

  const weightedSections = completeness.sections.filter((section) => (section.weight ?? 0) > 0);
  const understood = weightedSections.filter((s) => s.coverage >= 0.8).map((s) => plainLanguageSectionLabel(s.sectionKey));
  const notFullyCovered = weightedSections.filter((s) => s.coverage < 0.8).map((s) => plainLanguageSectionLabel(s.sectionKey));

  let status: BrainReadinessStatus;
  if (openConflicts > 0) status = "CONFLICT";
  else if (!readiness.readyForEducational) status = "MISSING";
  else if (!readiness.readyForCommercial) status = "NEEDS_REVIEW";
  else status = "READY";

  const statusDescription =
    status === "CONFLICT"
      ? "We found different answers for the same thing — pick which one is right."
      : readiness.statements.join(" ");

  return {
    clientName: client.name,
    status,
    statusLabel: STATUS_LABEL[status],
    statusDescription,
    whatWeUnderstand: understood,
    whatWeStillNeed: notFullyCovered,
    nextBestAction,
  };
}

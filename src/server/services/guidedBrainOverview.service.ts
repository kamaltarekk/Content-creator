import "server-only";

import { prisma } from "@/server/db/prisma";
import { plainLanguageSectionLabel } from "@/server/domain/brain-schema";
import { getCompletenessForClient } from "@/server/services/missingData.service";

/**
 * Guided Mode never shows a percentage or a dense section list — only these
 * four states (spec: "only 4 visible states"). Internal completeness scoring
 * still exists underneath and remains visible in Expert Mode.
 */
export type BrainReadinessStatus = "READY" | "NEEDS_REVIEW" | "MISSING" | "CONFLICT";

export type NextBestAction = {
  title: string;
  description: string;
  actionLabel: string;
  href: string;
};

export type GuidedBrainOverview = {
  clientName: string;
  status: BrainReadinessStatus;
  statusLabel: string;
  statusDescription: string;
  whatWeUnderstand: string[];
  whatWeStillNeed: string[];
  nextBestAction: NextBestAction;
};

const STATUS_COPY: Record<BrainReadinessStatus, { label: string; description: string }> = {
  READY: {
    label: "Ready",
    description: "We understand enough about this client to create Reels.",
  },
  NEEDS_REVIEW: {
    label: "Needs Review",
    description: "We have a working picture, but a few things could use a closer look.",
  },
  MISSING: {
    label: "Missing",
    description: "Some important information hasn't been added yet.",
  },
  CONFLICT: {
    label: "Conflict",
    description: "We found different answers for the same thing — pick which one is right.",
  },
};

/**
 * Computes the Guided Client Brain overview: a 4-state status, a plain-
 * language "what we understand" / "what we still need" summary, and a single
 * Next Best Action. The Next Best Action logic here is a first pass built on
 * existing readiness signals (conflicts, guided setup progress, completeness
 * coverage) — it will be superseded by the dedicated nextBestActionService
 * once script readiness rules exist, without changing this function's shape.
 */
export async function getGuidedBrainOverview(clientId: string): Promise<GuidedBrainOverview> {
  const [client, completeness, openConflicts, latestSession, reelCount] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true } }),
    getCompletenessForClient(clientId),
    prisma.conflict.count({ where: { clientId, status: "OPEN" } }),
    prisma.guidedSetupSession.findFirst({ where: { clientId }, orderBy: { startedAt: "desc" } }),
    prisma.reelGeneration.count({ where: { clientId } }),
  ]);

  const weightedSections = completeness.sections.filter((section) => (section.weight ?? 0) > 0);
  const understood = weightedSections.filter((s) => s.coverage >= 0.8).map((s) => plainLanguageSectionLabel(s.sectionKey));
  const missingSections = weightedSections.filter((s) => s.coverage === 0).map((s) => plainLanguageSectionLabel(s.sectionKey));
  const partialSections = weightedSections
    .filter((s) => s.coverage > 0 && s.coverage < 0.8)
    .map((s) => plainLanguageSectionLabel(s.sectionKey));

  let status: BrainReadinessStatus;
  if (openConflicts > 0) status = "CONFLICT";
  else if (missingSections.length > 0) status = "MISSING";
  else if (partialSections.length > 0) status = "NEEDS_REVIEW";
  else status = "READY";

  const setupIncomplete = !latestSession || latestSession.status === "IN_PROGRESS";

  let nextBestAction: NextBestAction;
  if (openConflicts > 0) {
    nextBestAction = {
      title: "Resolve a conflict",
      description: `We found ${openConflicts} conflicting answer${openConflicts === 1 ? "" : "s"} that need a decision before we can trust this client's information.`,
      actionLabel: "Review conflicts",
      href: `/c/${clientId}/brain/conflicts`,
    };
  } else if (setupIncomplete) {
    nextBestAction = {
      title: "Finish guided setup",
      description: "A few quick questions are left before we have everything needed to create a Reel.",
      actionLabel: latestSession ? "Continue setup" : "Start guided setup",
      href: `/c/${clientId}/setup`,
    };
  } else if (missingSections.length > 0) {
    nextBestAction = {
      title: `Add ${missingSections[0]}`,
      description: "This is missing entirely, so it's the highest-value thing to fill in next.",
      actionLabel: "Review missing information",
      href: `/c/${clientId}/brain/missing-data`,
    };
  } else if (reelCount === 0) {
    nextBestAction = {
      title: "Create the first Reel",
      description: "Everything needed is in place — let's turn it into a Reel.",
      actionLabel: "Create first Reel",
      href: `/c/${clientId}/reels/new`,
    };
  } else {
    nextBestAction = {
      title: "Review what's partial",
      description: "A few sections could use more detail to improve future Reels.",
      actionLabel: "See all Client Brain details",
      href: `/c/${clientId}/brain/expert`,
    };
  }

  return {
    clientName: client.name,
    status,
    statusLabel: STATUS_COPY[status].label,
    statusDescription: STATUS_COPY[status].description,
    whatWeUnderstand: understood,
    whatWeStillNeed: [...missingSections, ...partialSections],
    nextBestAction,
  };
}

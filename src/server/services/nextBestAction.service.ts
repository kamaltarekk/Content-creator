import "server-only";

import { prisma } from "@/server/db/prisma";
import { getScriptReadiness } from "@/server/services/scriptReadiness.service";

export type NextBestAction = {
  title: string;
  description: string;
  actionLabel: string;
  href: string;
};

/**
 * Picks the single highest-value next step for this client (spec section
 * 20): resolve conflicts first (nothing else can be trusted until they are),
 * then finish guided setup, then close the highest-priority readiness gap,
 * then clear pending AI suggestion reviews, then create the first Reel once
 * ready. Every Guided Mode page shows exactly one of these.
 */
export async function getNextBestAction(clientId: string): Promise<NextBestAction> {
  const [openConflicts, latestSession, readiness, pendingSuggestions, reelCount] = await Promise.all([
    prisma.conflict.count({ where: { clientId, status: "OPEN" } }),
    prisma.guidedSetupSession.findFirst({ where: { clientId }, orderBy: { startedAt: "desc" } }),
    getScriptReadiness(clientId),
    prisma.strategySuggestion.count({ where: { clientId, status: "AI_SUGGESTED" } }),
    prisma.reelGeneration.count({ where: { clientId } }),
  ]);

  if (openConflicts > 0) {
    return {
      title: "Resolve a conflict",
      description: `We found ${openConflicts} conflicting answer${openConflicts === 1 ? "" : "s"} that need a decision before we can trust this client's information.`,
      actionLabel: "Review conflicts",
      href: `/c/${clientId}/brain/conflicts`,
    };
  }

  const setupIncomplete = !latestSession || latestSession.status === "IN_PROGRESS";
  if (setupIncomplete) {
    return {
      title: "Finish guided setup",
      description: "A few quick questions are left before we have everything needed to create a Reel.",
      actionLabel: latestSession ? "Continue setup" : "Start guided setup",
      href: `/c/${clientId}/setup`,
    };
  }

  const topAnyReelGap = readiness.gaps.find((gap) => gap.scope === "ANY_REEL");
  if (topAnyReelGap) {
    return {
      title: `Add ${topAnyReelGap.label.toLowerCase()}`,
      description: topAnyReelGap.message,
      actionLabel: "Review missing information",
      href: `/c/${clientId}/brain/missing-data`,
    };
  }

  if (pendingSuggestions > 0) {
    return {
      title: "Review AI suggestions",
      description: `${pendingSuggestions} AI-suggested item${pendingSuggestions === 1 ? "" : "s"} still need${pendingSuggestions === 1 ? "s" : ""} a decision.`,
      actionLabel: "Review suggestions",
      href: `/c/${clientId}/strategy/reviews`,
    };
  }

  if (reelCount === 0) {
    return {
      title: "Create the first Reel",
      description: "Everything needed is in place — let's turn it into a Reel.",
      actionLabel: "Create first Reel",
      href: `/c/${clientId}/reels/new`,
    };
  }

  const topCommercialGap = readiness.gaps.find((gap) => gap.scope === "COMMERCIAL_REEL");
  if (topCommercialGap) {
    return {
      title: topCommercialGap.label,
      description: topCommercialGap.message,
      actionLabel: "Review missing information",
      href: `/c/${clientId}/brain/missing-data`,
    };
  }

  return {
    title: "Create another Reel",
    description: "This client is fully ready — create the next Reel whenever you're ready.",
    actionLabel: "Create a Reel",
    href: `/c/${clientId}/reels/new`,
  };
}

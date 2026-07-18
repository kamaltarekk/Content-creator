import Link from "next/link";

import { prisma } from "@/server/db/prisma";
import { getStrategyReadinessForClient } from "@/server/services/strategyReadiness.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StrategyReadinessPanel } from "@/components/strategy/strategy-readiness-panel";

export default async function StrategyOverviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const [cohortCount, situationCount, decisionCount, beliefCount, pendingSuggestions, readiness, recentCohorts] =
    await Promise.all([
      prisma.cohort.count({ where: { clientId, status: { not: "ARCHIVED" } } }),
      prisma.commercialSituation.count({ where: { clientId, status: { not: "ARCHIVED" } } }),
      prisma.buyingDecision.count({ where: { clientId, status: { not: "ARCHIVED" } } }),
      prisma.beliefMap.count({ where: { clientId } }),
      prisma.strategySuggestion.count({ where: { clientId, status: "AI_SUGGESTED" } }),
      getStrategyReadinessForClient(clientId),
      prisma.cohort.findMany({
        where: { clientId, status: { not: "ARCHIVED" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true, priority: true, approvalStatus: true, updatedAt: true },
      }),
    ]);

  const counters = [
    { label: "Cohorts", value: cohortCount, href: `/c/${clientId}/strategy/cohorts` },
    { label: "Commercial situations", value: situationCount, href: `/c/${clientId}/strategy/cohorts` },
    { label: "Buying decisions", value: decisionCount, href: `/c/${clientId}/strategy/decisions` },
    { label: "Belief maps", value: beliefCount, href: `/c/${clientId}/strategy/beliefs` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Strategy</p>
          <h1 className="text-2xl font-semibold text-foreground">Strategy Intelligence Overview</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            The commercial reasoning chain built on the approved Client Brain: cohort → commercial situation →
            trigger → active problem → current belief → behavior → commercial consequence → evidence → better
            belief → better commercial decision.
          </p>
        </div>
        <div className="flex gap-2">
          {pendingSuggestions > 0 && (
            <Button asChild variant="outline">
              <Link href={`/c/${clientId}/strategy/reviews`}>
                Suggestion reviews
                <Badge variant="warning" className="ml-1.5">
                  {pendingSuggestions}
                </Badge>
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href={`/c/${clientId}/strategy/cohorts`}>Cohort Lab</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counters.map((counter) => (
          <Link
            key={counter.label}
            href={counter.href}
            className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-lime/50"
          >
            <p className="text-2xl font-semibold text-foreground tabular-nums">{counter.value}</p>
            <p className="text-xs text-muted-foreground">{counter.label}</p>
          </Link>
        ))}
      </div>

      <StrategyReadinessPanel readiness={readiness} />

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Recently updated cohorts</p>
        {recentCohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cohorts yet. Start in the Cohort Lab — a cohort must be grounded in a real commercial situation, not
            a demographic label.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentCohorts.map((cohort) => (
              <li key={cohort.id}>
                <Link
                  href={`/c/${clientId}/strategy/cohorts/${cohort.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-elevated/60"
                >
                  <span className="text-foreground">{cohort.name}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{cohort.priority}</Badge>
                    <Badge variant={cohort.approvalStatus === "APPROVED" ? "success" : "muted"}>
                      {cohort.approvalStatus}
                    </Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

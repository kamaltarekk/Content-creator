import Link from "next/link";

import { BELIEF_TYPE_LABELS } from "@/server/domain/strategy-schema";
import type { BeliefType, StrategyApprovalStatus } from "@prisma/client";
import type { BeliefQualityResult } from "@/server/domain/belief-quality";
import { Badge } from "@/components/ui/badge";
import { EvidenceBadge } from "@/components/strategy/evidence-badge";

const APPROVAL_VARIANT = {
  AI_SUGGESTED: "warning",
  DRAFT: "muted",
  UNDER_REVIEW: "outline",
  APPROVED: "success",
  REJECTED: "destructive",
  DISPUTED: "warning",
} as const;

export type BeliefListItem = {
  id: string;
  currentBeliefStatement: string;
  beliefType: BeliefType;
  approvalStatus: StrategyApprovalStatus;
  cohortName: string;
  evidenceLinks: { evidenceStrength: "ANECDOTAL" | "WEAK" | "MODERATE" | "STRONG" | "VERIFIED" | "DISPUTED" }[];
  quality: BeliefQualityResult;
};

export function BeliefsListView({ clientId, beliefs }: { clientId: string; beliefs: BeliefListItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Strategy · Beliefs</p>
        <h1 className="text-2xl font-semibold text-foreground">Belief-to-Decision Engine</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every belief map across cohorts, with its evidence state and reframe quality. Add new ones from a
          cohort&apos;s Beliefs tab.
        </p>
      </div>

      {beliefs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No belief maps yet</p>
          <p className="max-w-md text-sm text-muted-foreground">Open a cohort and add a belief from its Beliefs tab.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {beliefs.map((belief) => (
            <Link
              key={belief.id}
              href={`/c/${clientId}/strategy/beliefs/${belief.id}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-lime/50"
            >
              <p className="line-clamp-2 font-medium text-foreground">{belief.currentBeliefStatement}</p>
              <p className="text-xs text-muted-foreground">Cohort: {belief.cohortName}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{BELIEF_TYPE_LABELS[belief.beliefType]}</Badge>
                <Badge variant={APPROVAL_VARIANT[belief.approvalStatus]}>{belief.approvalStatus}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <EvidenceBadge links={belief.evidenceLinks} />
                <Badge variant={belief.quality.level === "strong" ? "success" : belief.quality.level === "moderate" ? "muted" : "warning"}>
                  {belief.quality.level} reframe
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

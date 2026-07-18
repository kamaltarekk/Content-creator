import Link from "next/link";

import type { BuyingDecisionListItemView } from "@/types/strategy";
import { DECISION_TYPE_LABELS } from "@/server/domain/strategy-schema";
import { Badge } from "@/components/ui/badge";

const APPROVAL_VARIANT = {
  AI_SUGGESTED: "warning",
  DRAFT: "muted",
  UNDER_REVIEW: "outline",
  APPROVED: "success",
  REJECTED: "destructive",
  DISPUTED: "warning",
} as const;

export function BuyingDecisionMapView({ clientId, decisions }: { clientId: string; decisions: BuyingDecisionListItemView[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Strategy · Buying Decisions</p>
        <h1 className="text-2xl font-semibold text-foreground">Buying Decision Map</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every decision a cohort needs to make, who is involved in making it, and what stands in the way. Add
          decisions from a cohort&apos;s detail page.
        </p>
      </div>

      {decisions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No buying decisions yet</p>
          <p className="max-w-md text-sm text-muted-foreground">Open a cohort and add a decision from its Decisions tab.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {decisions.map((decision) => (
            <Link
              key={decision.id}
              href={`/c/${clientId}/strategy/decisions/${decision.id}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-lime/50"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{decision.title}</p>
                <Badge variant="outline">{DECISION_TYPE_LABELS[decision.decisionType]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Cohort: {decision.cohort.name}</p>
              {decision.commercialSituationTitle && (
                <p className="text-xs text-muted-foreground">Situation: {decision.commercialSituationTitle}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={APPROVAL_VARIANT[decision.approvalStatus]}>{decision.approvalStatus}</Badge>
              </div>
              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                <span>{decision.participantCount} committee</span>
                <span>{decision.objectionCount} objection{decision.objectionCount === 1 ? "" : "s"}</span>
                <span>{decision.criterionCount} criteri{decision.criterionCount === 1 ? "on" : "a"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

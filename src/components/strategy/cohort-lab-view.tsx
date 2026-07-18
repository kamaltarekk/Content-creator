"use client";

import Link from "next/link";

import type { CohortListItemView } from "@/types/strategy";
import { Badge } from "@/components/ui/badge";
import { CreateCohortDialog } from "@/components/strategy/create-cohort-dialog";

const APPROVAL_VARIANT = {
  AI_SUGGESTED: "warning",
  DRAFT: "muted",
  UNDER_REVIEW: "outline",
  APPROVED: "success",
  REJECTED: "destructive",
  DISPUTED: "warning",
} as const;

const QUALITY_VARIANT = { strong: "success", moderate: "muted", weak: "warning" } as const;

export function CohortLabView({
  clientId,
  cohorts,
  canEdit,
}: {
  clientId: string;
  cohorts: CohortListItemView[];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Strategy · Cohorts</p>
          <h1 className="text-2xl font-semibold text-foreground">Cohort Lab</h1>
        </div>
        {canEdit && <CreateCohortDialog clientId={clientId} />}
      </div>

      {cohorts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No cohorts yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            A cohort is a real commercial situation, not a demographic label. Start by naming the specific situation
            a group of people are stuck in.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cohorts.map((cohort) => (
            <Link
              key={cohort.id}
              href={`/c/${clientId}/strategy/cohorts/${cohort.id}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-lime/50"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{cohort.name}</p>
                <Badge variant="outline">{cohort.priority}</Badge>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {cohort.definition ?? "No grounded definition yet."}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={APPROVAL_VARIANT[cohort.approvalStatus]}>{cohort.approvalStatus}</Badge>
                <Badge variant={QUALITY_VARIANT[cohort.quality.level]}>{cohort.quality.level} quality</Badge>
                {cohort.quality.isGenericLabel && <Badge variant="destructive">Generic label</Badge>}
              </div>
              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                <span>{cohort.situationCount} situation{cohort.situationCount === 1 ? "" : "s"}</span>
                <span>{cohort.decisionCount} decision{cohort.decisionCount === 1 ? "" : "s"}</span>
                <span>{cohort.beliefCount} belief{cohort.beliefCount === 1 ? "" : "s"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

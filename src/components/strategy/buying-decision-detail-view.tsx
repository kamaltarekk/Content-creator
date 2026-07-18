"use client";

import Link from "next/link";
import { toast } from "sonner";

import type { BuyingDecisionDetailView as BuyingDecisionDetailViewType } from "@/types/strategy";
import { DECISION_TYPE_LABELS } from "@/server/domain/strategy-schema";
import { useSetDecisionApprovalStatus, useArchiveBuyingDecision } from "@/hooks/use-decision";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BuyingCommitteeVisual } from "@/components/strategy/buying-committee-visual";
import { BuyingCommitteeTable } from "@/components/strategy/buying-committee-table";
import { AddParticipantDialog } from "@/components/strategy/add-participant-dialog";
import { ObjectionsPanel } from "@/components/strategy/objections-panel";
import { CriteriaPanel } from "@/components/strategy/criteria-panel";

const APPROVAL_VARIANT = {
  AI_SUGGESTED: "warning",
  DRAFT: "muted",
  UNDER_REVIEW: "outline",
  APPROVED: "success",
  REJECTED: "destructive",
  DISPUTED: "warning",
} as const;

export function BuyingDecisionDetailView({
  clientId,
  decision,
  canEdit,
  canApprove,
}: {
  clientId: string;
  decision: BuyingDecisionDetailViewType;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const setApproval = useSetDecisionApprovalStatus();
  const archive = useArchiveBuyingDecision();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Buying decision · <Link href={`/c/${clientId}/strategy/cohorts/${decision.cohort.id}`} className="hover:text-lime hover:underline">{decision.cohort.name}</Link>
          </p>
          <h1 className="text-2xl font-semibold text-foreground">{decision.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{DECISION_TYPE_LABELS[decision.decisionType]}</Badge>
            <Badge variant={APPROVAL_VARIANT[decision.approvalStatus]}>{decision.approvalStatus}</Badge>
            {decision.commercialSituationTitle && <Badge variant="muted">{decision.commercialSituationTitle}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          {canApprove && decision.approvalStatus !== "APPROVED" && (
            <Button
              size="sm"
              disabled={setApproval.isPending}
              onClick={() =>
                setApproval.mutate(
                  { decisionId: decision.id, approvalStatus: "APPROVED" },
                  {
                    onSuccess: () => toast.success("Decision approved."),
                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
                  },
                )
              }
            >
              Approve
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              disabled={archive.isPending}
              onClick={() =>
                archive.mutate(decision.id, {
                  onSuccess: () => toast.success("Archived."),
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
                })
              }
            >
              Archive
            </Button>
          )}
        </div>
      </div>

      {decision.description && <p className="text-sm text-muted-foreground">{decision.description}</p>}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Buying committee</p>
          {canEdit && <AddParticipantDialog decisionId={decision.id} />}
        </div>
        <BuyingCommitteeVisual participants={decision.participants} />
        <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
          <BuyingCommitteeTable decisionId={decision.id} participants={decision.participants} canEdit={canEdit} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ObjectionsPanel decisionId={decision.id} objections={decision.objections} canEdit={canEdit} />
        <CriteriaPanel decisionId={decision.id} criteria={decision.criteria} canEdit={canEdit} />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { toast } from "sonner";
import { X } from "lucide-react";

import type { BeliefMapView } from "@/types/strategy";
import { BELIEF_TYPE_LABELS } from "@/server/domain/strategy-schema";
import { useSetBeliefApprovalStatus, useArchiveBeliefMap } from "@/hooks/use-belief";
import { useRemoveEvidenceLink } from "@/hooks/use-evidence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvidenceBadge } from "@/components/strategy/evidence-badge";
import { AddEvidenceDialog } from "@/components/strategy/add-evidence-dialog";

const APPROVAL_VARIANT = {
  AI_SUGGESTED: "warning",
  DRAFT: "muted",
  UNDER_REVIEW: "outline",
  APPROVED: "success",
  REJECTED: "destructive",
  DISPUTED: "warning",
} as const;

const STRENGTH_VARIANT = {
  ANECDOTAL: "muted",
  WEAK: "muted",
  MODERATE: "outline",
  STRONG: "success",
  VERIFIED: "success",
  DISPUTED: "destructive",
} as const;

function ChainStep({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 border-border pl-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm whitespace-pre-wrap text-foreground">{value ?? "—"}</p>
    </div>
  );
}

export function BeliefDetailView({
  clientId,
  belief,
  cohortName,
  canEdit,
  canApprove,
}: {
  clientId: string;
  belief: BeliefMapView & { commercialSituationTitle: string | null; cohortId: string };
  cohortName: string;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const setApproval = useSetBeliefApprovalStatus();
  const archive = useArchiveBeliefMap();
  const removeEvidence = useRemoveEvidenceLink();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Belief map ·{" "}
            <Link href={`/c/${clientId}/strategy/cohorts/${belief.cohortId}`} className="hover:text-lime hover:underline">
              {cohortName}
            </Link>
          </p>
          <h1 className="text-xl font-semibold text-foreground">{belief.currentBeliefStatement}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{BELIEF_TYPE_LABELS[belief.beliefType]}</Badge>
            <Badge variant={APPROVAL_VARIANT[belief.approvalStatus]}>{belief.approvalStatus}</Badge>
            <EvidenceBadge links={belief.evidenceLinks} />
          </div>
        </div>
        <div className="flex gap-2">
          {canApprove && belief.approvalStatus !== "APPROVED" && (
            <Button
              size="sm"
              disabled={setApproval.isPending}
              onClick={() =>
                setApproval.mutate(
                  { beliefMapId: belief.id, approvalStatus: "APPROVED" },
                  {
                    onSuccess: () => toast.success("Belief approved."),
                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
                  },
                )
              }
            >
              Approve
            </Button>
          )}
          {canApprove && belief.approvalStatus !== "DISPUTED" && (
            <Button
              size="sm"
              variant="outline"
              disabled={setApproval.isPending}
              onClick={() =>
                setApproval.mutate(
                  { beliefMapId: belief.id, approvalStatus: "DISPUTED" },
                  {
                    onSuccess: () => toast.success("Marked as disputed."),
                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
                  },
                )
              }
            >
              Dispute
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              disabled={archive.isPending}
              onClick={() =>
                archive.mutate(belief.id, {
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_300px]">
        {/* Left: reasoning chain */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Reasoning chain</p>
          <ChainStep label="Observed situation" value={belief.observedSituation} />
          <ChainStep label="Current interpretation" value={belief.currentInterpretation} />
          <ChainStep label="Current (wrong) belief" value={belief.currentBeliefStatement} />
          <ChainStep label="Behavior caused" value={belief.behaviorCaused} />
          <ChainStep label="Commercial consequence" value={belief.commercialConsequence} />
          <ChainStep label="Better belief" value={belief.betterBeliefStatement} />
          <ChainStep label="Better commercial decision" value={belief.betterCommercialDecision} />
          <ChainStep label="Relevant offer (placeholder)" value={belief.relevantOfferPlaceholder} />
        </div>

        {/* Center: evidence / source context */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Evidence</p>
            {canEdit && <AddEvidenceDialog clientId={clientId} beliefMapId={belief.id} />}
          </div>
          {belief.evidenceLinks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No evidence linked yet — this is a hypothesis, not a validated belief.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {belief.evidenceLinks.map((link) => (
                <div key={link.id} className="flex items-start justify-between gap-2 rounded-md border border-border bg-card p-3">
                  <div>
                    <Badge variant={STRENGTH_VARIANT[link.evidenceStrength]}>{link.evidenceStrength}</Badge>
                    <p className="mt-1 text-sm text-foreground">{link.description}</p>
                    {link.note && <p className="text-xs text-muted-foreground">{link.note}</p>}
                  </div>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground"
                      onClick={() => removeEvidence.mutate({ evidenceLinkId: link.id, clientId, beliefMapId: belief.id })}
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {belief.commercialSituationTitle && (
            <p className="text-xs text-muted-foreground">Linked situation: {belief.commercialSituationTitle}</p>
          )}
        </div>

        {/* Right: validation, confidence, approval */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Validation</p>
          <Badge variant={belief.quality.level === "strong" ? "success" : belief.quality.level === "moderate" ? "muted" : "warning"}>
            {belief.quality.level} quality
          </Badge>
          {belief.quality.isTrivialReframe && <Badge variant="destructive">Trivial reframe</Badge>}
          {belief.quality.issues.length > 0 && (
            <ul className="flex flex-col gap-1">
              {belief.quality.issues.map((issue) => (
                <li key={issue.field} className="text-xs text-warning">
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

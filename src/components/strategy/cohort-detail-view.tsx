"use client";

import { toast } from "sonner";

import type { CohortDetailView as CohortDetailViewType } from "@/types/strategy";
import { TRIGGER_TYPE_LABELS, DECISION_TYPE_LABELS, BUYING_ROLE_LABELS, BELIEF_TYPE_LABELS } from "@/server/domain/strategy-schema";
import { useSetCohortApprovalStatus, useArchiveCohort } from "@/hooks/use-cohort";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CohortQualityPanel } from "@/components/strategy/cohort-quality-panel";
import { EditCohortDialog } from "@/components/strategy/edit-cohort-dialog";
import { AddCohortSourceDialog } from "@/components/strategy/add-cohort-source-dialog";
import { AddSituationDialog } from "@/components/strategy/add-situation-dialog";
import { AddDecisionDialog } from "@/components/strategy/add-decision-dialog";
import Link from "next/link";

const APPROVAL_VARIANT = {
  AI_SUGGESTED: "warning",
  DRAFT: "muted",
  UNDER_REVIEW: "outline",
  APPROVED: "success",
  REJECTED: "destructive",
  DISPUTED: "warning",
} as const;

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm whitespace-pre-wrap text-foreground">{value ?? "—"}</p>
    </div>
  );
}

export function CohortDetailView({
  clientId,
  cohort,
  canEdit,
  canApprove,
}: {
  clientId: string;
  cohort: CohortDetailViewType;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const setApproval = useSetCohortApprovalStatus();
  const archive = useArchiveCohort();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Cohort</p>
          <h1 className="text-2xl font-semibold text-foreground">{cohort.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{cohort.priority}</Badge>
            <Badge variant={APPROVAL_VARIANT[cohort.approvalStatus]}>{cohort.approvalStatus}</Badge>
            <span className="text-xs text-muted-foreground">v{cohort.currentVersionNumber}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && <EditCohortDialog cohort={cohort} />}
          {canApprove && cohort.approvalStatus !== "APPROVED" && (
            <Button
              size="sm"
              disabled={setApproval.isPending}
              onClick={() =>
                setApproval.mutate(
                  { cohortId: cohort.id, approvalStatus: "APPROVED" },
                  {
                    onSuccess: () => toast.success("Cohort approved."),
                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
                  },
                )
              }
            >
              Approve
            </Button>
          )}
          {canApprove && cohort.approvalStatus !== "DISPUTED" && cohort.approvalStatus !== "REJECTED" && (
            <Button
              size="sm"
              variant="outline"
              disabled={setApproval.isPending}
              onClick={() =>
                setApproval.mutate(
                  { cohortId: cohort.id, approvalStatus: "DISPUTED" },
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
                archive.mutate(cohort.id, {
                  onSuccess: () => toast.success("Cohort archived."),
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
                })
              }
            >
              Archive
            </Button>
          )}
        </div>
      </div>

      <CohortQualityPanel quality={cohort.quality} />

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="situations">Situations ({cohort.commercialSituations.length})</TabsTrigger>
          <TabsTrigger value="decisions">Decisions ({cohort.buyingDecisions.length})</TabsTrigger>
          <TabsTrigger value="beliefs">Beliefs ({cohort.beliefMaps.length})</TabsTrigger>
          <TabsTrigger value="sources">Sources ({cohort.sourceReferences.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Definition" value={cohort.definition} />
            <Field label="Role" value={cohort.role} />
            <Field label="Commercial context" value={cohort.commercialContext} />
            <Field label="Current workflow" value={cohort.currentWorkflow} />
            <Field label="Current belief" value={cohort.currentBelief} />
            <Field label="Desired outcome" value={cohort.desiredOutcome} />
            <Field label="Decision risk" value={cohort.decisionRisk} />
            <Field label="Attention notes" value={cohort.attentionNotes} />
          </div>
        </TabsContent>

        <TabsContent value="situations" className="flex flex-col gap-3">
          {canEdit && (
            <div className="flex justify-end">
              <AddSituationDialog clientId={clientId} cohortId={cohort.id} />
            </div>
          )}
          {cohort.commercialSituations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No commercial situations yet — what real-world trigger put this cohort in this position?
            </p>
          ) : (
            cohort.commercialSituations.map((situation) => (
              <div key={situation.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{situation.title}</p>
                  <Badge variant="outline">{TRIGGER_TYPE_LABELS[situation.triggerType]}</Badge>
                </div>
                <Field label="Trigger" value={situation.triggerDescription} />
                <Field label="Active problem" value={situation.activeProblem} />
                <Field label="Current workflow" value={situation.currentWorkflow} />
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="decisions" className="flex flex-col gap-3">
          {canEdit && (
            <div className="flex justify-end">
              <AddDecisionDialog clientId={clientId} cohortId={cohort.id} navigateToDetail />
            </div>
          )}
          {cohort.buyingDecisions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No buying decisions yet — what exact decision does this cohort need to make?
            </p>
          ) : (
            cohort.buyingDecisions.map((decision) => (
              <div key={decision.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/c/${clientId}/strategy/decisions/${decision.id}`}
                    className="font-medium text-foreground hover:text-lime hover:underline"
                  >
                    {decision.title}
                  </Link>
                  <Badge variant="outline">{DECISION_TYPE_LABELS[decision.decisionType]}</Badge>
                </div>
                <Field label="Description" value={decision.description} />
                {decision.participants.length > 0 && (
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Buying committee</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {decision.participants.map((p) => (
                        <li key={p.id} className="text-sm text-foreground">
                          {p.label} — <span className="text-muted-foreground">{BUYING_ROLE_LABELS[p.role]}</span>
                          {p.stance && <span className="text-muted-foreground"> ({p.stance})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {decision.objections.length > 0 && (
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Objections</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {decision.objections.map((o) => (
                        <li key={o.id} className="text-sm text-foreground">
                          {o.title} <Badge variant="outline">{o.severity}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="beliefs" className="flex flex-col gap-3">
          {cohort.beliefMaps.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No belief maps yet — build one in the Belief-to-Decision Engine.
            </p>
          ) : (
            cohort.beliefMaps.map((belief) => (
              <div key={belief.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{belief.currentBeliefStatement}</p>
                  <Badge variant="outline">{BELIEF_TYPE_LABELS[belief.beliefType]}</Badge>
                </div>
                <Field label="Better belief" value={belief.betterBeliefStatement} />
                <Field label="Better commercial decision" value={belief.betterCommercialDecision} />
                <p className="text-xs text-muted-foreground">
                  {belief.evidenceLinks.length} evidence link{belief.evidenceLinks.length === 1 ? "" : "s"} ·{" "}
                  {Math.round(belief.quality.score * 100)}% quality
                </p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="sources" className="flex flex-col gap-3">
          <div className="flex justify-end">
            {canEdit && <AddCohortSourceDialog clientId={clientId} cohortId={cohort.id} />}
          </div>
          {cohort.sourceReferences.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No sources linked yet. A cohort should be grounded in real evidence, not invented.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {cohort.sourceReferences.map((ref) => (
                <div key={ref.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
                  <div>
                    <Badge variant="outline">{ref.relationshipType.replace(/_/g, " ").toLowerCase()}</Badge>
                    {ref.note && <p className="mt-1 text-sm text-foreground">{ref.note}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(ref.linkedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="flex flex-col gap-2">
          {cohort.versions.map((version) => (
            <div key={version.versionNumber} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
              <div>
                <span className="text-sm font-medium text-foreground">v{version.versionNumber}</span>{" "}
                <Badge variant="outline" className="ml-1">
                  {version.changeType}
                </Badge>
                {version.changeNote && <p className="mt-1 text-xs text-muted-foreground">{version.changeNote}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { notFound } from "next/navigation";

import { requireAction, can } from "@/server/auth/permissions";
import { getCohortDetail } from "@/server/services/cohort.service";
import { validateBeliefQuality } from "@/server/domain/belief-quality";
import type { CohortDetailView as CohortDetailViewType } from "@/types/strategy";
import { CohortDetailView } from "@/components/strategy/cohort-detail-view";

export default async function CohortDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; cohortId: string }>;
}) {
  const { clientId, cohortId } = await params;
  const session = await requireAction("strategy.view", { clientId });
  const canEdit = can(session.user, "strategy.edit", { clientId });
  const canApprove = can(session.user, "strategy.approve", { clientId });

  const cohort = await getCohortDetail(cohortId);
  if (!cohort || cohort.clientId !== clientId) notFound();

  const view: CohortDetailViewType = {
    id: cohort.id,
    name: cohort.name,
    definition: cohort.definition,
    priority: cohort.priority,
    role: cohort.role,
    commercialContext: cohort.commercialContext,
    currentWorkflow: cohort.currentWorkflow,
    currentBelief: cohort.currentBelief,
    desiredOutcome: cohort.desiredOutcome,
    decisionRisk: cohort.decisionRisk,
    emotionalDrivers: cohort.emotionalDrivers,
    platformPresence: cohort.platformPresence,
    attentionNotes: cohort.attentionNotes,
    status: cohort.status,
    approvalStatus: cohort.approvalStatus,
    currentVersionNumber: cohort.currentVersionNumber,
    quality: cohort.quality,
    commercialSituations: cohort.commercialSituations.map((s) => ({
      id: s.id,
      title: s.title,
      triggerType: s.triggerType,
      triggerDescription: s.triggerDescription,
      activeProblem: s.activeProblem,
      currentWorkflow: s.currentWorkflow,
      urgencyNote: s.urgencyNote,
      status: s.status,
      approvalStatus: s.approvalStatus,
    })),
    buyingDecisions: cohort.buyingDecisions.map((d) => ({
      id: d.id,
      title: d.title,
      decisionType: d.decisionType,
      description: d.description,
      timeframe: d.timeframe,
      status: d.status,
      approvalStatus: d.approvalStatus,
      commercialSituationId: d.commercialSituationId,
      participants: d.participants.map((p) => ({
        id: p.id,
        role: p.role,
        label: p.label,
        influenceScore: p.influenceScore,
        stance: p.stance,
        notes: p.notes,
      })),
      objections: d.objections.map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        raisedByRole: o.raisedByRole,
        severity: o.severity,
        resolutionNote: o.resolutionNote,
      })),
      criteria: d.criteria.map((c) => ({ id: c.id, label: c.label, weightNote: c.weightNote, importance: c.importance })),
    })),
    beliefMaps: cohort.beliefMaps.map((b) => ({
      id: b.id,
      observedSituation: b.observedSituation,
      currentInterpretation: b.currentInterpretation,
      currentBeliefStatement: b.currentBeliefStatement,
      beliefType: b.beliefType,
      behaviorCaused: b.behaviorCaused,
      commercialConsequence: b.commercialConsequence,
      betterBeliefStatement: b.betterBeliefStatement,
      betterCommercialDecision: b.betterCommercialDecision,
      relevantOfferPlaceholder: b.relevantOfferPlaceholder,
      approvalStatus: b.approvalStatus,
      commercialSituationId: b.commercialSituationId,
      evidenceLinks: b.evidenceLinks.map((e) => ({
        id: e.id,
        description: e.description,
        evidenceStrength: e.evidenceStrength,
        clientBrainItemId: e.clientBrainItemId,
        sourceId: e.sourceId,
        note: e.note,
      })),
      quality: validateBeliefQuality({
        currentBeliefStatement: b.currentBeliefStatement,
        behaviorCaused: b.behaviorCaused,
        commercialConsequence: b.commercialConsequence,
        betterBeliefStatement: b.betterBeliefStatement,
        betterCommercialDecision: b.betterCommercialDecision,
        hasEvidence: b.evidenceLinks.length > 0,
      }),
    })),
    sourceReferences: cohort.sourceReferences.map((r) => ({
      id: r.id,
      relationshipType: r.relationshipType,
      clientBrainItemId: r.clientBrainItemId,
      extractedItemId: r.extractedItemId,
      sourceId: r.sourceId,
      sourceBlockId: r.sourceBlockId,
      audienceSignalNote: r.audienceSignalNote,
      note: r.note,
      linkedAt: r.linkedAt.toISOString(),
    })),
    versions: cohort.versions.map((v) => ({
      versionNumber: v.versionNumber,
      changeType: v.changeType,
      changeNote: v.changeNote,
      changedById: v.changedById,
      createdAt: v.createdAt.toISOString(),
    })),
    updatedAt: cohort.updatedAt.toISOString(),
  };

  return <CohortDetailView clientId={clientId} cohort={view} canEdit={canEdit} canApprove={canApprove} />;
}

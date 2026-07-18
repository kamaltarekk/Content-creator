import { notFound } from "next/navigation";

import { requireAction, can } from "@/server/auth/permissions";
import { getBuyingDecisionDetail } from "@/server/services/buyingDecision.service";
import type { BuyingDecisionDetailView as BuyingDecisionDetailViewType } from "@/types/strategy";
import { BuyingDecisionDetailView } from "@/components/strategy/buying-decision-detail-view";

export default async function BuyingDecisionDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; decisionId: string }>;
}) {
  const { clientId, decisionId } = await params;
  const session = await requireAction("strategy.view", { clientId });
  const canEdit = can(session.user, "strategy.edit", { clientId });
  const canApprove = can(session.user, "strategy.approve", { clientId });

  const decision = await getBuyingDecisionDetail(decisionId);
  if (!decision || decision.clientId !== clientId) notFound();

  const view: BuyingDecisionDetailViewType = {
    id: decision.id,
    title: decision.title,
    decisionType: decision.decisionType,
    description: decision.description,
    timeframe: decision.timeframe,
    status: decision.status,
    approvalStatus: decision.approvalStatus,
    commercialSituationId: decision.commercialSituationId,
    cohort: decision.cohort,
    commercialSituationTitle: decision.commercialSituation?.title ?? null,
    participants: decision.participants.map((p) => ({
      id: p.id,
      role: p.role,
      label: p.label,
      influenceScore: p.influenceScore,
      stance: p.stance,
      notes: p.notes,
    })),
    objections: decision.objections.map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description,
      raisedByRole: o.raisedByRole,
      severity: o.severity,
      resolutionNote: o.resolutionNote,
    })),
    criteria: decision.criteria.map((c) => ({ id: c.id, label: c.label, weightNote: c.weightNote, importance: c.importance })),
  };

  return <BuyingDecisionDetailView clientId={clientId} decision={view} canEdit={canEdit} canApprove={canApprove} />;
}

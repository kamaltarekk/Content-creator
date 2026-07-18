import { requireAction } from "@/server/auth/permissions";
import { listBuyingDecisions } from "@/server/services/buyingDecision.service";
import type { BuyingDecisionListItemView } from "@/types/strategy";
import { BuyingDecisionMapView } from "@/components/strategy/buying-decision-map-view";

export default async function BuyingDecisionsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireAction("strategy.view", { clientId });

  const decisions = await listBuyingDecisions(clientId);
  const view: BuyingDecisionListItemView[] = decisions.map((d) => ({
    id: d.id,
    title: d.title,
    decisionType: d.decisionType,
    status: d.status,
    approvalStatus: d.approvalStatus,
    cohort: d.cohort,
    commercialSituationTitle: d.commercialSituation?.title ?? null,
    participantCount: d.participants.length,
    objectionCount: d.objections.length,
    criterionCount: d.criteria.length,
  }));

  return <BuyingDecisionMapView clientId={clientId} decisions={view} />;
}

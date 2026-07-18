import { notFound } from "next/navigation";

import { requireAction, can } from "@/server/auth/permissions";
import { getBeliefMapDetail } from "@/server/services/belief.service";
import { BeliefDetailView } from "@/components/strategy/belief-detail-view";

export default async function BeliefDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; beliefId: string }>;
}) {
  const { clientId, beliefId } = await params;
  const session = await requireAction("strategy.view", { clientId });
  const canEdit = can(session.user, "strategy.edit", { clientId });
  const canApprove = can(session.user, "strategy.approve", { clientId });

  const belief = await getBeliefMapDetail(beliefId);
  if (!belief || belief.clientId !== clientId) notFound();

  return (
    <BeliefDetailView
      clientId={clientId}
      cohortName={belief.cohort.name}
      canEdit={canEdit}
      canApprove={canApprove}
      belief={{
        id: belief.id,
        observedSituation: belief.observedSituation,
        currentInterpretation: belief.currentInterpretation,
        currentBeliefStatement: belief.currentBeliefStatement,
        beliefType: belief.beliefType,
        behaviorCaused: belief.behaviorCaused,
        commercialConsequence: belief.commercialConsequence,
        betterBeliefStatement: belief.betterBeliefStatement,
        betterCommercialDecision: belief.betterCommercialDecision,
        relevantOfferPlaceholder: belief.relevantOfferPlaceholder,
        approvalStatus: belief.approvalStatus,
        commercialSituationId: belief.commercialSituationId,
        commercialSituationTitle: belief.commercialSituation?.title ?? null,
        cohortId: belief.cohortId,
        evidenceLinks: belief.evidenceLinks.map((e) => ({
          id: e.id,
          description: e.description,
          evidenceStrength: e.evidenceStrength,
          clientBrainItemId: e.clientBrainItemId,
          sourceId: e.sourceId,
          note: e.note,
        })),
        quality: belief.quality,
      }}
    />
  );
}

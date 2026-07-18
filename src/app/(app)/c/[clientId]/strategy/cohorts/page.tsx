import { requireAction, can } from "@/server/auth/permissions";
import { listCohorts } from "@/server/services/cohort.service";
import type { CohortListItemView } from "@/types/strategy";
import { CohortLabView } from "@/components/strategy/cohort-lab-view";

export default async function CohortLabPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const session = await requireAction("strategy.view", { clientId });
  const canEdit = can(session.user, "strategy.edit", { clientId });

  const cohorts = await listCohorts(clientId);
  const view: CohortListItemView[] = cohorts.map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    definition: cohort.definition,
    priority: cohort.priority,
    status: cohort.status,
    approvalStatus: cohort.approvalStatus,
    situationCount: cohort.commercialSituations.length,
    decisionCount: cohort.buyingDecisions.length,
    beliefCount: cohort.beliefMaps.length,
    sourceReferenceCount: cohort._count.sourceReferences,
    quality: cohort.quality,
    updatedAt: cohort.updatedAt.toISOString(),
  }));

  return <CohortLabView clientId={clientId} cohorts={view} canEdit={canEdit} />;
}

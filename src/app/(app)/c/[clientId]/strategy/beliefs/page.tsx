import { requireAction } from "@/server/auth/permissions";
import { listBeliefMaps } from "@/server/services/belief.service";
import { BeliefsListView, type BeliefListItem } from "@/components/strategy/beliefs-list-view";

export default async function BeliefsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireAction("strategy.view", { clientId });

  const beliefs = await listBeliefMaps(clientId);
  const view: BeliefListItem[] = beliefs.map((belief) => ({
    id: belief.id,
    currentBeliefStatement: belief.currentBeliefStatement,
    beliefType: belief.beliefType,
    approvalStatus: belief.approvalStatus,
    cohortName: belief.cohort.name,
    evidenceLinks: belief.evidenceLinks.map((e) => ({ evidenceStrength: e.evidenceStrength })),
    quality: belief.quality,
  }));

  return <BeliefsListView clientId={clientId} beliefs={view} />;
}

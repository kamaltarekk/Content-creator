import { requireAction, can } from "@/server/auth/permissions";
import { listStrategicEntities, listStrategicRelationships } from "@/server/services/strategicRelationship.service";
import { StrategicRelationshipGraphView } from "@/components/strategy/strategic-relationship-graph-view";

export default async function RelationshipsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const session = await requireAction("strategy.view", { clientId });
  const canEdit = can(session.user, "strategy.edit", { clientId });

  const [entities, relationships] = await Promise.all([
    listStrategicEntities(clientId),
    listStrategicRelationships(clientId),
  ]);

  return (
    <StrategicRelationshipGraphView
      clientId={clientId}
      entities={entities}
      relationships={relationships.map((r) => ({
        id: r.id,
        relationshipType: r.relationshipType,
        note: r.note,
        fromEntity: r.fromEntity,
        toEntity: r.toEntity,
      }))}
      canEdit={canEdit}
    />
  );
}

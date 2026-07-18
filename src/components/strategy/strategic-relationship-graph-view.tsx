import type { StrategicEntityView, StrategicRelationshipView } from "@/types/strategy";
import { StrategicGraphVisual } from "@/components/strategy/strategic-graph-visual";
import { StrategicRelationshipsTable } from "@/components/strategy/strategic-relationships-table";
import { AddRelationshipDialog } from "@/components/strategy/add-relationship-dialog";

export function StrategicRelationshipGraphView({
  clientId,
  entities,
  relationships,
  canEdit,
}: {
  clientId: string;
  entities: StrategicEntityView[];
  relationships: StrategicRelationshipView[];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Strategy · Relationships</p>
          <h1 className="text-2xl font-semibold text-foreground">Strategic Relationship Graph</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            How cohorts, situations, decisions, roles, beliefs, and evidence connect — a reference layer, not a
            duplicate of the data itself.
          </p>
        </div>
        {canEdit && entities.length > 1 && <AddRelationshipDialog clientId={clientId} entities={entities} />}
      </div>

      <StrategicGraphVisual entities={entities} relationships={relationships} />
      <StrategicRelationshipsTable clientId={clientId} relationships={relationships} canEdit={canEdit} />
    </div>
  );
}

import { STRATEGIC_ENTITY_TYPE_LABELS, STRATEGIC_RELATIONSHIP_TYPE_LABELS } from "@/server/domain/strategy-schema";
import type { StrategicEntityView, StrategicRelationshipView } from "@/types/strategy";
import { Badge } from "@/components/ui/badge";

/**
 * A lightweight, self-contained relationship map — no external graph
 * library. Entities are grouped into columns by type; relationships render
 * as short "A -> relationship -> B" connector rows beneath. Always paired
 * with the accessible StrategicRelationshipsTable, which is the actual
 * editable surface.
 */
export function StrategicGraphVisual({
  entities,
  relationships,
}: {
  entities: StrategicEntityView[];
  relationships: StrategicRelationshipView[];
}) {
  const entityTypes = Array.from(new Set(entities.map((e) => e.entityType)));

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      {entities.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No strategy entities yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entityTypes.map((type) => (
            <div key={type} className="flex flex-col gap-1.5 rounded-md border border-border p-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {STRATEGIC_ENTITY_TYPE_LABELS[type]}
              </p>
              {entities
                .filter((e) => e.entityType === type)
                .map((e) => (
                  <div key={e.id} className="truncate rounded-sm bg-elevated px-2 py-1 text-xs text-foreground" title={e.title}>
                    {e.title}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {relationships.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Connections</p>
          <ul className="flex flex-col gap-1">
            {relationships.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-foreground">{r.fromEntity.title}</span>
                <Badge variant="outline">{STRATEGIC_RELATIONSHIP_TYPE_LABELS[r.relationshipType]}</Badge>
                <span className="text-foreground">{r.toEntity.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

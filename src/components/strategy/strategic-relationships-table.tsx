"use client";

import { toast } from "sonner";
import { X } from "lucide-react";

import { STRATEGIC_ENTITY_TYPE_LABELS, STRATEGIC_RELATIONSHIP_TYPE_LABELS } from "@/server/domain/strategy-schema";
import type { StrategicRelationshipView } from "@/types/strategy";
import { useRemoveStrategicRelationship } from "@/hooks/use-relationship";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** The always-present, editable surface for the relationship graph — never visualization-only. */
export function StrategicRelationshipsTable({
  clientId,
  relationships,
  canEdit,
}: {
  clientId: string;
  relationships: StrategicRelationshipView[];
  canEdit: boolean;
}) {
  const remove = useRemoveStrategicRelationship();

  if (relationships.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No relationships recorded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>From</TableHead>
            <TableHead>Relationship</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Note</TableHead>
            {canEdit && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {relationships.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <span className="text-foreground">{r.fromEntity.title}</span>
                <span className="ml-1 text-xs text-muted-foreground">({STRATEGIC_ENTITY_TYPE_LABELS[r.fromEntity.entityType]})</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{STRATEGIC_RELATIONSHIP_TYPE_LABELS[r.relationshipType]}</Badge>
              </TableCell>
              <TableCell>
                <span className="text-foreground">{r.toEntity.title}</span>
                <span className="ml-1 text-xs text-muted-foreground">({STRATEGIC_ENTITY_TYPE_LABELS[r.toEntity.entityType]})</span>
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal text-muted-foreground">{r.note ?? "—"}</TableCell>
              {canEdit && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(
                        { relationshipId: r.id, clientId },
                        {
                          onSuccess: () => toast.success("Removed."),
                          onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
                        },
                      )
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

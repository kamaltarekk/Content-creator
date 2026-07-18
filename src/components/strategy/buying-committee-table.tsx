"use client";

import { toast } from "sonner";
import { X } from "lucide-react";

import { BUYING_ROLE_LABELS } from "@/server/domain/strategy-schema";
import type { BuyingRoleParticipantView } from "@/types/strategy";
import { useRemoveBuyingRoleParticipant } from "@/hooks/use-decision";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { stanceVariant } from "@/components/strategy/buying-committee-visual";

/** The always-present, editable surface for the buying committee — never visualization-only. */
export function BuyingCommitteeTable({
  decisionId,
  participants,
  canEdit,
}: {
  decisionId: string;
  participants: BuyingRoleParticipantView[];
  canEdit: boolean;
}) {
  const remove = useRemoveBuyingRoleParticipant();

  if (participants.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No committee members yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Influence</TableHead>
          <TableHead>Stance</TableHead>
          <TableHead>Notes</TableHead>
          {canEdit && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {participants.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium text-foreground">{p.label}</TableCell>
            <TableCell>{BUYING_ROLE_LABELS[p.role]}</TableCell>
            <TableCell>{p.influenceScore ?? "—"}</TableCell>
            <TableCell>{p.stance ? <Badge variant={stanceVariant(p.stance)}>{p.stance}</Badge> : "—"}</TableCell>
            <TableCell className="max-w-xs whitespace-normal text-muted-foreground">{p.notes ?? "—"}</TableCell>
            {canEdit && (
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(
                      { participantId: p.id, decisionId },
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
  );
}

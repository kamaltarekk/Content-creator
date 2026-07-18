"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

import type { DecisionCriterionView } from "@/types/strategy";
import { useAddDecisionCriterion, useRemoveDecisionCriterion } from "@/hooks/use-decision";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CriteriaPanel({
  decisionId,
  criteria,
  canEdit,
}: {
  decisionId: string;
  criteria: DecisionCriterionView[];
  canEdit: boolean;
}) {
  const [label, setLabel] = useState("");
  const add = useAddDecisionCriterion();
  const remove = useRemoveDecisionCriterion();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">Decision criteria</p>
      {criteria.length === 0 ? (
        <p className="text-sm text-muted-foreground">None recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {criteria.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-md border border-border p-2">
              <span className="text-sm text-foreground">
                {c.label} <Badge variant="outline">{c.importance}</Badge>
                {c.weightNote && <span className="ml-1 text-xs text-muted-foreground">— {c.weightNote}</span>}
              </span>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-muted-foreground"
                  onClick={() => remove.mutate({ criterionId: c.id, decisionId })}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex gap-2">
          <Input placeholder="Add a decision criterion…" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button
            size="sm"
            disabled={!label.trim() || add.isPending}
            onClick={() =>
              add.mutate(
                { decisionId, fields: { label } },
                {
                  onSuccess: () => setLabel(""),
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
                },
              )
            }
          >
            <Plus className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

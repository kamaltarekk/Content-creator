"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, Check } from "lucide-react";

import type { ObjectionView } from "@/types/strategy";
import { useAddObjection, useResolveObjection, useRemoveObjection } from "@/hooks/use-decision";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ObjectionsPanel({
  decisionId,
  objections,
  canEdit,
}: {
  decisionId: string;
  objections: ObjectionView[];
  canEdit: boolean;
}) {
  const [title, setTitle] = useState("");
  const add = useAddObjection();
  const resolve = useResolveObjection();
  const remove = useRemoveObjection();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">Objections &amp; risks</p>
      {objections.length === 0 ? (
        <p className="text-sm text-muted-foreground">None recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {objections.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2">
              <div>
                <p className="text-sm text-foreground">
                  {o.title} <Badge variant={o.severity === "CRITICAL" || o.severity === "HIGH" ? "warning" : "outline"}>{o.severity}</Badge>
                </p>
                {o.description && <p className="text-xs text-muted-foreground">{o.description}</p>}
                {o.resolutionNote && <p className="text-xs text-lime">Resolved: {o.resolutionNote}</p>}
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  {!o.resolutionNote && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() =>
                        resolve.mutate(
                          { objectionId: o.id, decisionId, resolutionNote: "Addressed" },
                          { onError: (error) => toast.error(error instanceof Error ? error.message : "Failed.") },
                        )
                      }
                    >
                      <Check className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-muted-foreground"
                    onClick={() => remove.mutate({ objectionId: o.id, decisionId })}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex gap-2">
          <Input placeholder="Add an objection or risk…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button
            size="sm"
            disabled={!title.trim() || add.isPending}
            onClick={() =>
              add.mutate(
                { decisionId, fields: { title } },
                {
                  onSuccess: () => setTitle(""),
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

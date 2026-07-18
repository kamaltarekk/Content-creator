"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Archive, Check, X } from "lucide-react";

import { FIELD_LABELS } from "@/server/domain/brain-schema";
import type { BrainItemView } from "@/types/brain";
import { useEditBrainItem, useArchiveBrainItem } from "@/hooks/use-brain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SourceTraceDialog } from "@/components/brain/source-trace-dialog";
import { VersionHistoryDialog } from "@/components/brain/version-history-dialog";

const STATUS_VARIANT = {
  ACTIVE: "success",
  DRAFT: "muted",
  DISPUTED: "warning",
  ARCHIVED: "muted",
} as const;

export function BrainItemCard({ item, canEdit }: { item: BrainItemView; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.valueText ?? "");
  const edit = useEditBrainItem();
  const archive = useArchiveBrainItem();

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {FIELD_LABELS[item.fieldKey]}
          </span>
          <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
          {item.confidence !== null && (
            <Badge variant="outline" className="tabular-nums">
              {Math.round(item.confidence * 100)}%
            </Badge>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea rows={3} value={value} onChange={(e) => setValue(e.target.value)} />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={edit.isPending}
              onClick={() =>
                edit.mutate(
                  { itemId: item.id, valueText: value },
                  {
                    onSuccess: () => {
                      toast.success("Updated.");
                      setEditing(false);
                    },
                    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
                  },
                )
              }
            >
              <Check className="size-4" />
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="size-4" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-foreground">{item.valueText ?? "—"}</p>
      )}

      {item.subjectLabel && <p className="text-xs text-muted-foreground">Entity: {item.subjectLabel}</p>}

      <div className="flex flex-wrap items-center gap-1">
        <SourceTraceDialog itemId={item.id} hasTrace={item.hasSourceTrace} />
        <VersionHistoryDialog itemId={item.id} />
        {canEdit && !editing && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        )}
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            disabled={archive.isPending}
            onClick={() =>
              archive.mutate(item.id, {
                onSuccess: () => toast.success("Archived."),
                onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
              })
            }
          >
            <Archive className="size-3.5" />
            Archive
          </Button>
        )}
      </div>
    </div>
  );
}

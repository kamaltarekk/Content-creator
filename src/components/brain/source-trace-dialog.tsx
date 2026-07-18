"use client";

import { useState } from "react";
import { format } from "date-fns";
import { FileText } from "lucide-react";

import { getSourceTraceAction } from "@/server/actions/brain.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type TraceEntry = Awaited<ReturnType<typeof getSourceTraceAction>>[number];

/** Every approved Client Brain item is traceable: this opens its source origin(s). */
export function SourceTraceDialog({ itemId, hasTrace }: { itemId: string; hasTrace: boolean }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<TraceEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setEntries(await getSourceTraceAction(itemId));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !entries) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={!hasTrace} className="h-7 px-2 text-xs">
          <FileText className="size-3.5" />
          View source
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Source traceability</DialogTitle>
          <DialogDescription>Where this Client Brain item came from, and who approved it.</DialogDescription>
        </DialogHeader>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {entries && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">
            This item was added manually and has no source document.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {entries?.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="size-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">{entry.sourceFileName}</span>
                {entry.sourceLocationLabel && (
                  <span className="text-muted-foreground">· {entry.sourceLocationLabel}</span>
                )}
              </div>
              {entry.originalText && (
                <p className="mt-2 whitespace-pre-wrap rounded bg-background/60 p-2 text-xs text-muted-foreground">
                  {entry.originalText}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Approved by {entry.approverName} · {format(new Date(entry.approvedAt), "MMM d, yyyy p")}
              </p>
              <Button asChild variant="link" size="sm" className="h-6 px-0 text-xs">
                <a href={`/api/sources/${entry.sourceId}/download`}>Download original</a>
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

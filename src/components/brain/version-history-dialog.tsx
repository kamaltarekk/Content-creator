"use client";

import { useState } from "react";
import { format } from "date-fns";
import { History } from "lucide-react";

import { getVersionHistoryAction } from "@/server/actions/brain.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type VersionEntry = Awaited<ReturnType<typeof getVersionHistoryAction>>[number];

export function VersionHistoryDialog({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setVersions(await getVersionHistoryAction(itemId));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !versions) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <History className="size-3.5" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>Every change to this item is preserved.</DialogDescription>
        </DialogHeader>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        <div className="flex flex-col gap-3">
          {versions?.map((version) => (
            <div key={version.versionNumber} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">v{version.versionNumber}</Badge>
                <Badge variant="muted">{version.changeType}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {version.changedByName} · {format(new Date(version.createdAt), "MMM d, p")}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{version.valueText ?? "—"}</p>
              {version.changeNote && (
                <p className="mt-1 text-xs text-muted-foreground italic">{version.changeNote}</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

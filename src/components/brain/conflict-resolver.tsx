"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { ChangeType, ConflictResolutionType } from "@prisma/client";

import { useResolveConflict } from "@/hooks/use-conflict";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export type ConflictView = {
  conflictId: string;
  clientId: string;
  fieldLabel: string;
  sectionLabel: string;
  changeType: ChangeType;
  detectedReason: string;
  existingValue: string;
  existingSource: string;
  proposedValue: string;
  proposedSource: string;
};

const CHANGE_VARIANT: Record<ChangeType, "muted" | "warning" | "destructive" | "success"> = {
  ADDED: "success",
  UPDATED: "warning",
  REMOVED: "warning",
  UNCHANGED: "muted",
  CONFLICTING: "destructive",
};

const RESOLUTIONS: { type: ConflictResolutionType; label: string; description: string }[] = [
  { type: "KEEP_EXISTING", label: "Keep existing", description: "Discard the new value; keep the approved one." },
  { type: "REPLACE", label: "Replace with new", description: "Adopt the new value as a new version." },
  { type: "MERGE", label: "Merge", description: "Store a combined value you write below." },
  { type: "STORE_BOTH", label: "Store both", description: "Keep both as context-specific values." },
  { type: "MARK_UNRESOLVED", label: "Mark unresolved", description: "Record the decision but leave it open." },
];

export function ConflictResolver({ conflict, canResolve }: { conflict: ConflictView; canResolve: boolean }) {
  const router = useRouter();
  const resolve = useResolveConflict();
  const [mergeValue, setMergeValue] = useState(conflict.proposedValue);

  function handle(type: ConflictResolutionType) {
    resolve.mutate(
      {
        conflictId: conflict.conflictId,
        resolutionType: type,
        resolvedValueText: type === "MERGE" ? mergeValue : type === "REPLACE" ? conflict.proposedValue : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Conflict resolved.");
          router.push(`/c/${conflict.clientId}/brain/conflicts`);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to resolve."),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant={CHANGE_VARIANT[conflict.changeType]}>{conflict.changeType}</Badge>
        <span className="text-sm text-muted-foreground">
          {conflict.sectionLabel} · {conflict.fieldLabel}
        </span>
      </div>
      <p className="text-sm text-warning">{conflict.detectedReason}</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Existing value
          </p>
          <p className="text-sm whitespace-pre-wrap text-foreground">{conflict.existingValue}</p>
          <p className="mt-2 text-xs text-muted-foreground">Source: {conflict.existingSource}</p>
        </div>
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            New proposed value
          </p>
          <p className="text-sm whitespace-pre-wrap text-foreground">{conflict.proposedValue}</p>
          <p className="mt-2 text-xs text-muted-foreground">Source: {conflict.proposedSource}</p>
        </div>
      </div>

      {!canResolve ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to resolve conflicts. Ask a strategist or admin.
        </p>
      ) : (
        <>
          <Separator />
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Merge value (used only for “Merge”)</p>
            <Textarea rows={3} value={mergeValue} onChange={(e) => setMergeValue(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {RESOLUTIONS.map((resolution) => (
              <Button
                key={resolution.type}
                variant={resolution.type === "MARK_UNRESOLVED" ? "ghost" : "outline"}
                size="sm"
                disabled={resolve.isPending}
                title={resolution.description}
                onClick={() => handle(resolution.type)}
              >
                {resolution.label}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

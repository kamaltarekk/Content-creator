"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import type { SourceProcessingStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const TERMINAL_STATUSES: SourceProcessingStatus[] = [
  "READY_FOR_REVIEW",
  "COMPLETED",
  "FAILED",
  "NEEDS_ATTENTION",
];

type StatusResponse = {
  processingStatus: SourceProcessingStatus;
  requiresMultimodal: boolean;
  blockCount: number;
  extractedItemCount: number;
};

const STATUS_BADGE: Record<SourceProcessingStatus, "muted" | "warning" | "success" | "destructive"> = {
  UPLOADED: "muted",
  QUEUED: "muted",
  PROCESSING: "muted",
  NEEDS_ATTENTION: "warning",
  READY_FOR_REVIEW: "success",
  COMPLETED: "success",
  FAILED: "destructive",
};

export function SourceStatusPoller({
  sourceId,
  initialStatus,
}: {
  sourceId: string;
  initialStatus: SourceProcessingStatus;
}) {
  const router = useRouter();
  const refreshedRef = useRef(false);

  const { data } = useQuery<StatusResponse>({
    queryKey: ["source-status", sourceId],
    queryFn: async () => {
      const res = await fetch(`/api/sources/${sourceId}/status`);
      if (!res.ok) throw new Error("Failed to load status");
      return res.json();
    },
    initialData: {
      processingStatus: initialStatus,
      requiresMultimodal: false,
      blockCount: 0,
      extractedItemCount: 0,
    },
    // Poll every 2s until the source reaches a terminal state.
    refetchInterval: (query) => {
      const status = query.state.data?.processingStatus;
      return status && TERMINAL_STATUSES.includes(status) ? false : 2000;
    },
  });

  const status = data.processingStatus;
  const isProcessing = !TERMINAL_STATUSES.includes(status);
  const settled = !isProcessing && status !== initialStatus;

  // Once processing settles into a new state, refresh the server-rendered
  // page a single time so block/item counts and job history are current.
  useEffect(() => {
    if (settled && !refreshedRef.current) {
      refreshedRef.current = true;
      router.refresh();
    }
  }, [settled, router]);

  return (
    <span className="inline-flex items-center gap-2">
      {isProcessing && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      <Badge variant={STATUS_BADGE[status]}>{status}</Badge>
    </span>
  );
}

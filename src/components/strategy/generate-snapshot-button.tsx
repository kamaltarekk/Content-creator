"use client";

import { toast } from "sonner";
import { Camera } from "lucide-react";

import { useGenerateReadinessSnapshot } from "@/hooks/use-readiness";
import { Button } from "@/components/ui/button";

export function GenerateSnapshotButton({ clientId }: { clientId: string }) {
  const generate = useGenerateReadinessSnapshot();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={generate.isPending}
      onClick={() =>
        generate.mutate(clientId, {
          onSuccess: () => toast.success("Readiness snapshot saved."),
          onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save snapshot."),
        })
      }
    >
      <Camera className="size-4" />
      {generate.isPending ? "Saving…" : "Save snapshot"}
    </Button>
  );
}

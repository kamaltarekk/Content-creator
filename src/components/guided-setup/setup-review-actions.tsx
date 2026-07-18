"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";

import { useCompleteGuidedSetup } from "@/hooks/use-guided-setup";
import { Button } from "@/components/ui/button";

export function SetupReviewActions({ clientId, sessionId }: { clientId: string; sessionId: string | null }) {
  const router = useRouter();
  const complete = useCompleteGuidedSetup();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={complete.isPending || !sessionId}
        onClick={() =>
          sessionId &&
          complete.mutate(
            { sessionId, clientId },
            {
              onSuccess: () => {
                toast.success("Setup approved.");
                router.push(`/c/${clientId}/reels/new`);
              },
              onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to complete setup."),
            },
          )
        }
      >
        <Check className="size-4" />
        Everything is correct
      </Button>
      <Button variant="outline" onClick={() => router.push(`/c/${clientId}/setup`)}>
        Edit an answer
      </Button>
      <Button variant="outline" onClick={() => router.push(`/c/${clientId}/brain`)}>
        Review missing information
      </Button>
      <Button variant="ghost" onClick={() => router.push(`/c/${clientId}/reels/new`)}>
        <Sparkles className="size-4" />
        Create first Reel
      </Button>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setBrainModePreferenceAction } from "@/server/actions/uiPreference.actions";
import { Button } from "@/components/ui/button";

export function BrainModeToggle({ clientId, mode }: { clientId: string; mode: "GUIDED" | "EXPERT" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const target = mode === "GUIDED" ? "EXPERT" : "GUIDED";
  const label = mode === "GUIDED" ? "Switch to Expert Mode" : "Switch to Guided Mode";
  const href = target === "GUIDED" ? `/c/${clientId}/brain` : `/c/${clientId}/brain/expert`;

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setBrainModePreferenceAction(target, clientId);
          router.push(href);
        })
      }
    >
      {label}
    </Button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { generateReadinessSnapshotAction } from "@/server/actions/readiness.actions";

export function useGenerateReadinessSnapshot() {
  const router = useRouter();
  return useMutation({
    mutationFn: (clientId: string) => generateReadinessSnapshotAction(clientId),
    onSuccess: () => router.refresh(),
  });
}

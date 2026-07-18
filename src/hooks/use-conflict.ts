"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { ConflictResolutionType } from "@prisma/client";

import { resolveConflictAction } from "@/server/actions/conflict.actions";

export function useResolveConflict() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: {
      conflictId: string;
      resolutionType: ConflictResolutionType;
      resolvedValueText?: string;
      note?: string;
    }) => resolveConflictAction(input),
    onSuccess: () => router.refresh(),
  });
}

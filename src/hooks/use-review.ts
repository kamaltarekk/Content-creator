"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import {
  resolveReviewAction,
  bulkApproveSafeAction,
  type ResolveReviewActionInput,
} from "@/server/actions/review.actions";

export function useResolveReview() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: ResolveReviewActionInput) => resolveReviewAction(input),
    onSuccess: () => router.refresh(),
  });
}

export function useBulkApproveSafe(clientId: string) {
  const router = useRouter();
  return useMutation({
    mutationFn: (reviewIds: string[]) => bulkApproveSafeAction(clientId, reviewIds),
    onSuccess: () => router.refresh(),
  });
}

"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { StrategicEntityType, StrategySuggestionAction, StrategySuggestionType } from "@prisma/client";

import {
  generateStrategySuggestionAction,
  resolveSuggestionAction,
  bulkApproveSuggestionsAction,
} from "@/server/actions/strategySuggestion.actions";

export function useGenerateStrategySuggestion() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { clientId: string; targetType: StrategySuggestionType }) =>
      generateStrategySuggestionAction(input.clientId, input.targetType),
    onSuccess: () => router.refresh(),
  });
}

export function useResolveSuggestion() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: {
      suggestionId: string;
      clientId: string;
      action: StrategySuggestionAction;
      targetCohortId?: string;
      targetDecisionId?: string;
      targetEntityType?: StrategicEntityType;
      targetEntityId?: string;
      edits?: Record<string, string>;
      resolutionNote?: string;
    }) => resolveSuggestionAction(input),
    onSuccess: () => router.refresh(),
  });
}

export function useBulkApproveSuggestions() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { clientId: string; suggestionIds: string[] }) =>
      bulkApproveSuggestionsAction(input.clientId, input.suggestionIds),
    onSuccess: () => router.refresh(),
  });
}

"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import {
  startGuidedSetupAction,
  getNextQuestionAction,
  submitAnswerAction,
  skipQuestionAction,
  requestAiSuggestionAction,
  completeGuidedSetupAction,
} from "@/server/actions/guidedSetup.actions";
import type { AnswerValue } from "@/server/services/guidedAnswer.service";

export function useNextQuestion(sessionId: string | null, clientId: string, refreshKey: number) {
  return useQuery({
    queryKey: ["guided-setup-next-question", sessionId, refreshKey],
    queryFn: () => getNextQuestionAction(sessionId!, clientId),
    enabled: Boolean(sessionId),
  });
}

export function useStartGuidedSetup() {
  return useMutation({
    mutationFn: (input: { clientId: string; entryMode?: "FULL_GUIDED" | "FAST_IMPORT" }) =>
      startGuidedSetupAction(input.clientId, input.entryMode),
  });
}

export function useSubmitAnswer() {
  return useMutation({
    mutationFn: (input: {
      sessionId: string;
      clientId: string;
      questionKey: string;
      value: AnswerValue;
      sourceType?: "USER_INPUT" | "EXISTING_CLIENT_BRAIN_ITEM" | "EXISTING_STRATEGY_ENTITY" | "AI_SUGGESTION";
    }) => submitAnswerAction(input),
  });
}

export function useSkipQuestion() {
  return useMutation({
    mutationFn: (input: { sessionId: string; clientId: string; questionKey: string; reason: "DONT_KNOW" | "NOT_APPLICABLE" }) =>
      skipQuestionAction(input),
  });
}

export function useRequestAiSuggestion() {
  return useMutation({
    mutationFn: (input: { clientId: string; questionKey: string }) => requestAiSuggestionAction(input.clientId, input.questionKey),
  });
}

export function useCompleteGuidedSetup() {
  return useMutation({
    mutationFn: (input: { sessionId: string; clientId: string }) => completeGuidedSetupAction(input.sessionId, input.clientId),
  });
}

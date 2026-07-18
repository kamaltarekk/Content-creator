"use server";

import { revalidatePath } from "next/cache";

import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { startOrResumeGuidedSetup, completeGuidedSetup } from "@/server/services/guidedSetup.service";
import { getNextQuestion, submitAnswer, skipQuestion, requestAiSuggestion, type AnswerValue } from "@/server/services/guidedAnswer.service";

export async function startGuidedSetupAction(clientId: string, entryMode?: "FULL_GUIDED" | "FAST_IMPORT") {
  const session = await requireAction("setup.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const setupSession = await startOrResumeGuidedSetup({
    clientId,
    organizationId: session.user.orgId,
    userId: session.user.id,
    entryMode,
  });

  return { sessionId: setupSession.id };
}

export async function getNextQuestionAction(sessionId: string, clientId: string) {
  await requireAction("setup.view", { clientId });
  const next = await getNextQuestion(sessionId, clientId);
  if (!next) return null;
  return {
    question: {
      key: next.question.key,
      section: next.question.section,
      userFacingQuestion: next.question.userFacingQuestion,
      helperText: next.question.helperText,
      example: next.question.example,
      answerType: next.question.answerType,
      options: next.question.options as { value: string; label: string }[] | null,
      requiredLevel: next.question.requiredLevel,
      plainLanguageLabel: next.question.plainLanguageLabel,
      expertLabel: next.question.expertLabel,
    },
    section: next.section,
    trusted: next.trusted,
  };
}

export async function submitAnswerAction(input: { sessionId: string; clientId: string; questionKey: string; value: AnswerValue; sourceType?: "USER_INPUT" | "EXISTING_CLIENT_BRAIN_ITEM" | "EXISTING_STRATEGY_ENTITY" | "AI_SUGGESTION" }) {
  const session = await requireAction("setup.edit", { clientId: input.clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await submitAnswer({
    sessionId: input.sessionId,
    clientId: input.clientId,
    organizationId: session.user.orgId,
    userId: session.user.id,
    questionKey: input.questionKey,
    value: input.value,
    sourceType: input.sourceType,
  });

  await prisma.guidedSetupSession.update({ where: { id: input.sessionId }, data: { currentQuestionKey: input.questionKey } });

  revalidatePath(`/c/${input.clientId}/setup`);
  return { ok: true };
}

export async function skipQuestionAction(input: { sessionId: string; clientId: string; questionKey: string; reason: "DONT_KNOW" | "NOT_APPLICABLE" }) {
  await requireAction("setup.edit", { clientId: input.clientId });
  await skipQuestion(input);
  revalidatePath(`/c/${input.clientId}/setup`);
  return { ok: true };
}

export async function requestAiSuggestionAction(clientId: string, questionKey: string) {
  await requireAction("setup.edit", { clientId });
  return requestAiSuggestion({ clientId, questionKey });
}

export async function completeGuidedSetupAction(sessionId: string, clientId: string) {
  const session = await requireAction("setup.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await completeGuidedSetup({ sessionId, organizationId: session.user.orgId, clientId, userId: session.user.id });
  revalidatePath(`/c/${clientId}/brain`);
  revalidatePath(`/c/${clientId}/setup`);
  return { ok: true };
}

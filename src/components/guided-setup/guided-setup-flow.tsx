"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, HelpCircle, Sparkles } from "lucide-react";

import { useNextQuestion, useSubmitAnswer, useSkipQuestion, useRequestAiSuggestion } from "@/hooks/use-guided-setup";
import { QuestionCard, type QuestionCardValue } from "@/components/guided-setup/question-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const SECTION_LABELS: Record<string, string> = {
  BUSINESS: "The Business",
  AUDIENCE: "The Audience",
  BELIEF_DECISION: "The Belief and Decision",
  OFFER: "The Offer",
  PROOF: "The Proof",
  VOICE: "The Voice",
  EXECUTION: "Reel Execution",
  SAFETY: "Safety and Constraints",
};

export function GuidedSetupFlow({ clientId, sessionId }: { clientId: string; sessionId: string }) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [draft, setDraft] = useState<QuestionCardValue>("");
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ value: string; reasoningSummary: string } | null>(null);

  const { data, isLoading } = useNextQuestion(sessionId, clientId, refreshKey);
  const submit = useSubmitAnswer();
  const skip = useSkipQuestion();
  const requestAi = useRequestAiSuggestion();

  const question = data?.question ?? null;
  const trusted = data?.trusted ?? null;
  const progress = data?.progress;

  if (question && draftKey !== question.key) {
    setDraftKey(question.key);
    setDraft(trusted?.value ?? "");
    setAiSuggestion(null);
  }

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  if (isLoading) {
    return <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!question) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-foreground">That&apos;s everything we need to ask.</p>
        <Button onClick={() => router.push(`/c/${clientId}/setup/review`)}>
          Review setup
          <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  const percent = progress && progress.totalActive > 0 ? Math.round((progress.answeredCount / progress.totalActive) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{SECTION_LABELS[question.section] ?? question.section}</span>
          <span>{percent}% through setup</span>
        </div>
        <Progress value={percent} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold text-foreground">{question.userFacingQuestion}</h1>
        {question.helperText && <p className="text-sm text-muted-foreground">{question.helperText}</p>}
        {question.example && <p className="text-xs text-muted-foreground italic">Example: {question.example}</p>}

        {trusted && draft === trusted.value && (
          <Badge variant="muted" className="w-fit">
            Prefilled from what we already know
          </Badge>
        )}
        {aiSuggestion && (
          <div className="rounded-md bg-elevated px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">AI suggestion:</span> {aiSuggestion.reasoningSummary}
          </div>
        )}

        <QuestionCard answerType={question.answerType} options={question.options} value={draft} onChange={setDraft} />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            disabled={submit.isPending || (typeof draft === "string" && !draft.trim() && question.answerType !== "BOOLEAN")}
            onClick={() =>
              submit.mutate(
                {
                  sessionId,
                  clientId,
                  questionKey: question.key,
                  value: draft,
                  sourceType: aiSuggestion ? "AI_SUGGESTION" : trusted && draft === trusted.value ? trusted.sourceType : "USER_INPUT",
                },
                {
                  onSuccess: () => {
                    refresh();
                  },
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save answer."),
                },
              )
            }
          >
            <Check className="size-4" />
            Confirm and continue
          </Button>
          <Button
            variant="outline"
            disabled={requestAi.isPending}
            onClick={() =>
              requestAi.mutate(
                { clientId, questionKey: question.key },
                {
                  onSuccess: (result) => {
                    setDraft(result.value);
                    setAiSuggestion({ value: result.value, reasoningSummary: result.reasoningSummary });
                  },
                  onError: (error) => toast.error(error instanceof Error ? error.message : "AI suggestions need an API key configured."),
                },
              )
            }
          >
            <Sparkles className="size-4" />
            {requestAi.isPending ? "Thinking…" : "Let AI suggest"}
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground"
            disabled={skip.isPending}
            onClick={() =>
              skip.mutate(
                { sessionId, clientId, questionKey: question.key, reason: "DONT_KNOW" },
                { onSuccess: refresh, onError: (error) => toast.error(error instanceof Error ? error.message : "Failed.") },
              )
            }
          >
            <HelpCircle className="size-4" />
            I don&apos;t know
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground"
            disabled={skip.isPending}
            onClick={() =>
              skip.mutate(
                { sessionId, clientId, questionKey: question.key, reason: "NOT_APPLICABLE" },
                { onSuccess: refresh, onError: (error) => toast.error(error instanceof Error ? error.message : "Failed.") },
              )
            }
          >
            Not applicable
          </Button>
        </div>
      </div>
    </div>
  );
}

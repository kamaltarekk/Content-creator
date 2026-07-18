"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

import { CONTENT_OBJECTIVE_OPTIONS, type ContentObjectiveValue } from "@/lib/reel-options";
import { usePreviewStrategicDirection, useCreateFirstReel } from "@/hooks/use-reel-generation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STYLE_OPTIONS = [
  { value: null, label: "Let AI decide" },
  { value: "DIRECT", label: "Direct" },
  { value: "STORY", label: "Story-driven" },
  { value: "CASE", label: "Case breakdown" },
  { value: "MYTH_BUSTING", label: "Myth-busting" },
  { value: "COMPARISON", label: "Comparison" },
  { value: "AUTHORITY", label: "Authority" },
  { value: "EDUCATIONAL", label: "Educational" },
] as const;

type StyleValue = (typeof STYLE_OPTIONS)[number]["value"];

export function CreateFirstReelWizard({ clientId, cohorts }: { clientId: string; cohorts: { id: string; name: string }[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [contentObjective, setContentObjective] = useState<ContentObjectiveValue | null>(null);
  const [cohortId, setCohortId] = useState<string | null>(cohorts[0]?.id ?? null);
  const [requestedStyle, setRequestedStyle] = useState<StyleValue>(null);

  const preview = usePreviewStrategicDirection();
  const create = useCreateFirstReel();

  function goToDirectionPreview() {
    if (!contentObjective || !cohortId) return;
    preview.mutate(
      { clientId, cohortId, contentObjective, platform: "INSTAGRAM_REELS" },
      { onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to preview strategic direction.") },
    );
    setStep(4);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Step {step} of 4</span>
        {step > 1 && (
          <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="size-3.5" />
            Back
          </button>
        )}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What should this Reel do?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {CONTENT_OBJECTIVE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setContentObjective(option.value)}
                className={`flex flex-col items-start gap-0.5 rounded-md border p-3 text-left transition-colors ${
                  contentObjective === option.value ? "border-lime bg-lime/[0.06]" : "border-border hover:bg-elevated"
                }`}
              >
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.helper}</span>
              </button>
            ))}
            <Button className="mt-2 w-fit" disabled={!contentObjective} onClick={() => setStep(2)}>
              Next
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Who should it speak to?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {cohorts.length === 0 && <p className="text-sm text-muted-foreground italic">No approved audience exists yet — finish guided setup first.</p>}
            {cohorts.map((cohort) => (
              <button
                key={cohort.id}
                onClick={() => setCohortId(cohort.id)}
                className={`rounded-md border p-3 text-left text-sm transition-colors ${
                  cohortId === cohort.id ? "border-lime bg-lime/[0.06] text-foreground" : "border-border text-foreground hover:bg-elevated"
                }`}
              >
                {cohort.name}
              </button>
            ))}
            <Button className="mt-2 w-fit" disabled={!cohortId} onClick={() => setStep(3)}>
              Next
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What style?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {STYLE_OPTIONS.map((option) => (
              <button
                key={option.label}
                onClick={() => setRequestedStyle(option.value)}
                className={`rounded-md border p-3 text-left text-sm transition-colors ${
                  requestedStyle === option.value ? "border-lime bg-lime/[0.06] text-foreground" : "border-border text-foreground hover:bg-elevated"
                }`}
              >
                {option.label}
              </button>
            ))}
            <Button className="mt-2 w-fit" onClick={goToDirectionPreview}>
              Next
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended strategic direction</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {preview.isPending && <p className="text-sm text-muted-foreground">Compiling what we know…</p>}
            {preview.data && (
              <>
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className="w-fit">
                    {preview.data.direction.funnelStage}
                  </Badge>
                  <p className="text-sm text-foreground">{preview.data.direction.summary}</p>
                </div>
                {preview.data.warnings.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {preview.data.warnings.map((warning, i) => (
                      <Badge key={i} variant="warning" className="w-fit whitespace-normal text-left">
                        {warning}
                      </Badge>
                    ))}
                  </div>
                )}
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Show why</summary>
                  <p className="mt-1">Objective: {contentObjective} · Audience: {preview.data.cohortName} · Cognitive goal: {preview.data.direction.cognitiveObjective}</p>
                </details>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={create.isPending || !contentObjective || !cohortId}
                    onClick={() =>
                      contentObjective &&
                      cohortId &&
                      create.mutate(
                        { clientId, cohortId, contentObjective, platform: "INSTAGRAM_REELS", requestedStyle: requestedStyle ?? undefined },
                        {
                          onSuccess: (result) => {
                            toast.success("Reel created.");
                            router.push(`/c/${clientId}/reels/${result.generationId}`);
                          },
                          onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to create the Reel."),
                        },
                      )
                    }
                  >
                    <Sparkles className="size-4" />
                    {create.isPending ? "Creating…" : "Create Reel"}
                  </Button>
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Change something
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

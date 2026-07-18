"use client";

import { useState } from "react";

import { compileScriptContextPreviewAction } from "@/server/actions/scriptContext.actions";
import type { ScriptGenerationContext } from "@/server/domain/script-generation-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const CONTENT_OBJECTIVES = [
  { value: "AWARENESS", label: "Awareness" },
  { value: "TRUST", label: "Trust" },
  { value: "EDUCATION", label: "Education" },
  { value: "BELIEF_CHANGE", label: "Belief change" },
  { value: "OBJECTION_HANDLING", label: "Objection handling" },
  { value: "OFFER_PROMOTION", label: "Offer promotion" },
] as const;

export function ContextPreviewForm({ clientId, cohorts }: { clientId: string; cohorts: { id: string; name: string }[] }) {
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [contentObjective, setContentObjective] = useState<(typeof CONTENT_OBJECTIVES)[number]["value"]>("EDUCATION");
  const [result, setResult] = useState<{ context: ScriptGenerationContext; warnings: string[] } | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Audience</label>
          <Select value={cohortId} onValueChange={setCohortId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a cohort" />
            </SelectTrigger>
            <SelectContent>
              {cohorts.map((cohort) => (
                <SelectItem key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Content objective</label>
          <Select value={contentObjective} onValueChange={(v) => setContentObjective(v as typeof contentObjective)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_OBJECTIVES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={isPending || !cohortId}
          onClick={async () => {
            setIsPending(true);
            setError(null);
            try {
              const compiled = await compileScriptContextPreviewAction({ clientId, cohortId, contentObjective, platform: "INSTAGRAM_REELS" });
              setResult(compiled);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to compile context.");
            } finally {
              setIsPending(false);
            }
          }}
        >
          {isPending ? "Compiling…" : "Compile context"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3">
          {result.warnings.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {result.warnings.map((warning, i) => (
                <Badge key={i} variant="warning" className="w-fit whitespace-normal text-left">
                  {warning}
                </Badge>
              ))}
            </div>
          )}
          <pre className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-elevated p-4 text-xs text-foreground">
            {JSON.stringify(result.context, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

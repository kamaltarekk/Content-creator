"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import type { StrategySuggestionType } from "@prisma/client";

import { useGenerateStrategySuggestion } from "@/hooks/use-strategy-suggestion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TYPE_OPTIONS: { value: StrategySuggestionType; label: string }[] = [
  { value: "COHORT", label: "Cohort" },
  { value: "COMMERCIAL_SITUATION", label: "Commercial situation" },
  { value: "BUYING_DECISION", label: "Buying decision" },
  { value: "BUYING_ROLE_PARTICIPANT", label: "Buying committee member" },
  { value: "BELIEF_MAP", label: "Belief map" },
  { value: "EVIDENCE_LINK", label: "Evidence link" },
];

/** AI never fabricates a suggestion without an API key — generation fails clearly instead. */
export function GenerateSuggestionButton({ clientId }: { clientId: string }) {
  const [targetType, setTargetType] = useState<StrategySuggestionType>("COHORT");
  const generate = useGenerateStrategySuggestion();

  return (
    <div className="flex items-center gap-2">
      <Select value={targetType} onValueChange={(v) => setTargetType(v as StrategySuggestionType)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        disabled={generate.isPending}
        onClick={() =>
          generate.mutate(
            { clientId, targetType },
            {
              onSuccess: () => toast.success("Suggestion generated — review it in the Suggestion Review Queue."),
              onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to generate a suggestion."),
            },
          )
        }
      >
        <Sparkles className="size-4" />
        {generate.isPending ? "Generating…" : "Generate suggestion"}
      </Button>
    </div>
  );
}

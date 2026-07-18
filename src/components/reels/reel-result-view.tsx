"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, RotateCw, Save, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

import type { ReelScriptPackage, ScriptSegment } from "@/server/domain/reel-script-package";
import type { ReelValidationResult } from "@/server/domain/reel-validation";
import { useChangeSelectedHook, useEditReelScript, useRegenerateReel } from "@/hooks/use-reel-generation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const GATE_LABELS: Record<string, string> = {
  STRATEGIC_GROUNDING: "Strategic grounding",
  FACTUAL_GROUNDING: "Factual grounding",
  VOICE: "Voice",
  CTA_FIT: "CTA fit",
  PRODUCTION_FEASIBILITY: "Production feasibility",
  DURATION: "Duration",
  COMPREHENSION: "Comprehension",
  CLAIM_SAFETY: "Claim safety",
};

function GateIcon({ status }: { status: string }) {
  if (status === "PASS") return <ShieldCheck className="size-3.5 text-lime" />;
  if (status === "WARNING") return <ShieldAlert className="size-3.5 text-warning" />;
  return <ShieldX className="size-3.5 text-destructive" />;
}

export function ReelResultView({
  clientId,
  reelGenerationId,
  package: pkg,
  validation,
  status,
  versionNumber,
}: {
  clientId: string;
  reelGenerationId: string;
  package: ReelScriptPackage;
  validation: ReelValidationResult;
  status: string;
  versionNumber: number;
}) {
  const [segments, setSegments] = useState<ScriptSegment[]>(pkg.script.segments);
  const changeSelectedHook = useChangeSelectedHook();
  const editScript = useEditReelScript();
  const regenerate = useRegenerateReel();

  const scriptDirty = JSON.stringify(segments) !== JSON.stringify(pkg.script.segments);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reel · version {versionNumber}</p>
          <h1 className="text-xl font-semibold text-foreground">{pkg.strategy.coreTakeaway}</h1>
        </div>
        <Badge variant={status === "READY" ? "success" : status === "ARCHIVED" ? "muted" : "warning"}>{status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reel direction</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">{pkg.strategy.funnelStage} · {pkg.strategy.cognitiveObjective}</p>
          {pkg.strategy.beliefShiftFrom && pkg.strategy.beliefShiftTo && (
            <p className="text-foreground">
              Shifting the belief from <span className="italic">&ldquo;{pkg.strategy.beliefShiftFrom}&rdquo;</span> to{" "}
              <span className="italic">&ldquo;{pkg.strategy.beliefShiftTo}&rdquo;</span>.
            </p>
          )}
          <p className="text-muted-foreground">{pkg.strategy.rationale}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hook options</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {pkg.hookOptions.map((hook, i) => (
            <div key={i} className={`flex flex-col gap-1.5 rounded-md border p-3 ${i === pkg.selectedHookIndex ? "border-lime bg-lime/[0.06]" : "border-border"}`}>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{hook.hookType}</Badge>
                {i === pkg.selectedHookIndex ? (
                  <Badge variant="success" className="gap-1">
                    <Check className="size-3" />
                    Selected
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={changeSelectedHook.isPending}
                    onClick={() =>
                      changeSelectedHook.mutate(
                        { clientId, reelGenerationId, hookIndex: i },
                        { onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to switch hooks.") },
                      )
                    }
                  >
                    Use this hook
                  </Button>
                )}
              </div>
              <p className="text-sm text-foreground">{hook.text}</p>
              <p className="text-xs text-muted-foreground">{hook.rationale}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Final spoken script</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {segments.map((segment, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">{segment.type}</span>
                <span>~{Math.round(segment.estimatedSeconds)}s</span>
              </div>
              <Textarea
                value={segment.text}
                onChange={(e) => setSegments((prev) => prev.map((s, j) => (j === i ? { ...s, text: e.target.value } : s)))}
              />
              {segment.visualDirection && <p className="text-xs text-muted-foreground italic">Visual: {segment.visualDirection}</p>}
            </div>
          ))}
          <Button
            className="w-fit"
            disabled={!scriptDirty || editScript.isPending}
            onClick={() =>
              editScript.mutate(
                { clientId, reelGenerationId, segments },
                {
                  onSuccess: () => toast.success("Script updated."),
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save the script."),
                },
              )
            }
          >
            <Save className="size-4" />
            Save changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Visual plan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-foreground">
          {pkg.production.visualPlan.length > 0 ? (
            pkg.production.visualPlan.map((line, i) => <p key={i}>• {line}</p>)
          ) : (
            <p className="text-muted-foreground italic">No specific visual plan — use the segment visual directions above.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Publishing package</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Platform</p>
            <p className="text-foreground">{pkg.meta.platform}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Format</p>
            <p className="text-foreground">{pkg.production.format}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Editing level</p>
            <p className="text-foreground">{pkg.production.editingLevel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Speaker</p>
            <p className="text-foreground">{pkg.production.speaker ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Call to action</p>
            <p className="text-foreground">{pkg.commercial.ctaText ?? "None"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Portfolio role</p>
            <p className="text-foreground">{pkg.commercial.portfolioRole}</p>
          </div>
        </CardContent>
      </Card>

      <details className="rounded-lg border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">Safety and sources</summary>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            {validation.gates.map((gate) => (
              <div key={gate.key} className="flex items-start gap-2">
                <GateIcon status={gate.status} />
                <div>
                  <p className="text-xs font-medium text-foreground">{GATE_LABELS[gate.key] ?? gate.key}</p>
                  <p className="text-xs text-muted-foreground">{gate.note}</p>
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-foreground">Sources ({pkg.sources.length})</p>
            <div className="flex flex-col gap-0.5">
              {pkg.sources.map((source, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {source.entityType}{source.field ? ` · ${source.field}` : ""}
                </p>
              ))}
            </div>
          </div>
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Improvement actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Pick a different hook above, edit the script directly, or regenerate the whole Reel from the same authorized information.</p>
          <Button
            variant="outline"
            className="w-fit"
            disabled={regenerate.isPending}
            onClick={() =>
              regenerate.mutate(
                { clientId, reelGenerationId },
                {
                  onSuccess: () => toast.success("Reel regenerated."),
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to regenerate."),
                },
              )
            }
          >
            <RotateCw className="size-4" />
            {regenerate.isPending ? "Regenerating…" : "Regenerate"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

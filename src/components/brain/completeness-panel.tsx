import type { CompletenessResult } from "@/server/services/completeness.service";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function barColor(coverage: number): string {
  if (coverage >= 0.8) return "bg-lime";
  if (coverage > 0) return "bg-warning";
  return "bg-muted-foreground/40";
}

export function CompletenessPanel({ completeness }: { completeness: CompletenessResult }) {
  const weighted = completeness.sections.filter((s) => s.weight !== null);
  const informational = completeness.sections.filter((s) => s.weight === null);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-semibold text-foreground tabular-nums">{completeness.overall}%</span>
        <div>
          <p className="text-sm font-medium text-foreground">Setup-completeness indicator</p>
          <p className="text-xs text-muted-foreground">
            A confidence-weighted view of how much of the Client Brain is filled in — not a quality score.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {weighted.map((section) => (
          <div key={section.sectionKey} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground">{section.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {Math.round(section.coverage * 100)}%{section.weight ? ` · ${section.weight}pt` : ""}
              </span>
            </div>
            <Progress value={section.coverage * 100} indicatorClassName={cn(barColor(section.coverage))} />
          </div>
        ))}
      </div>

      {informational.some((s) => s.itemCount > 0) && (
        <p className="text-xs text-muted-foreground">
          Also tracked (unweighted):{" "}
          {informational
            .filter((s) => s.itemCount > 0)
            .map((s) => `${s.label} (${s.itemCount})`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

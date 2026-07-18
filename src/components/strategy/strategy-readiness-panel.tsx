import { READINESS_CATEGORY_LABELS } from "@/server/domain/strategy-schema";
import type { StrategyReadinessResult } from "@/server/services/strategyReadiness.service";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function barColor(coverage: number): string {
  if (coverage >= 0.8) return "bg-lime";
  if (coverage > 0) return "bg-warning";
  return "bg-muted-foreground/40";
}

/** Always labeled "Strategy Setup Readiness" — never presented as a prediction of business success. */
export function StrategyReadinessPanel({ readiness }: { readiness: StrategyReadinessResult }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-semibold text-foreground tabular-nums">{readiness.overall}%</span>
        <div>
          <p className="text-sm font-medium text-foreground">Strategy Setup Readiness</p>
          <p className="text-xs text-muted-foreground">
            How much of the commercial reasoning chain is in place across your cohorts — not a prediction of
            business success.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {readiness.categories.map((category) => (
          <div key={category.category} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground">{READINESS_CATEGORY_LABELS[category.category]}</span>
              <span className="text-muted-foreground tabular-nums">
                {Math.round(category.coverage * 100)}% · {category.weight}pt
              </span>
            </div>
            <Progress value={category.coverage * 100} indicatorClassName={cn(barColor(category.coverage))} />
          </div>
        ))}
      </div>

      {readiness.followUpQuestions.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground">Follow-up questions</p>
          <ul className="flex flex-col gap-1">
            {readiness.followUpQuestions.map((q) => (
              <li key={q.category} className="text-xs text-muted-foreground">
                {q.question}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

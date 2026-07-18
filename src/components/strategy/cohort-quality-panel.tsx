import type { CohortQualityResult } from "@/server/domain/cohort-quality";
import { Badge } from "@/components/ui/badge";

const LEVEL_VARIANT = { strong: "success", moderate: "muted", weak: "warning" } as const;

/** Deterministic quality feedback — never auto-rewrites, only surfaces what a human should address. */
export function CohortQualityPanel({ quality }: { quality: CohortQualityResult }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Badge variant={LEVEL_VARIANT[quality.level]}>{quality.level} quality</Badge>
        {quality.isGenericLabel && <Badge variant="destructive">Reads as a generic label</Badge>}
        <span className="text-xs text-muted-foreground">{Math.round(quality.score * 100)}% of grounding criteria met</span>
      </div>
      {quality.issues.length > 0 && (
        <ul className="flex flex-col gap-1">
          {quality.issues.map((issue) => (
            <li key={issue.field} className="text-xs text-warning">
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

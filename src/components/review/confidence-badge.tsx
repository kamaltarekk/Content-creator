import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Confidence is always visible in the review UI so uncertainty is never hidden. */
export function ConfidenceBadge({ confidence, className }: { confidence: number; className?: string }) {
  const pct = Math.round(confidence * 100);
  const variant = confidence >= 0.75 ? "success" : confidence >= 0.55 ? "muted" : "warning";
  return (
    <Badge variant={variant} className={cn("tabular-nums", className)}>
      {pct}% confidence
    </Badge>
  );
}

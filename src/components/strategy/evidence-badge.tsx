import type { EvidenceStrength } from "@prisma/client";

import { evidenceState } from "@/server/domain/evidence";
import { Badge } from "@/components/ui/badge";

const STATE_LABEL = {
  missing: "Missing evidence",
  contradictory: "Contradictory evidence",
  weak: "Weak evidence",
  exists: "Evidence exists",
} as const;

const STATE_VARIANT = {
  missing: "warning",
  contradictory: "destructive",
  weak: "warning",
  exists: "success",
} as const;

/** Always visibly distinguishes evidence exists / weak / missing / contradictory. */
export function EvidenceBadge({ links }: { links: { evidenceStrength: EvidenceStrength }[] }) {
  const state = evidenceState(links);
  return <Badge variant={STATE_VARIANT[state]}>{STATE_LABEL[state]}</Badge>;
}

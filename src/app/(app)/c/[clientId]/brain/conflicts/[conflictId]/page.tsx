import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireClientAccess, can } from "@/server/auth/permissions";
import { getConflictById, compareValues } from "@/server/services/conflict.service";
import { SECTION_LABELS, FIELD_LABELS } from "@/server/domain/brain-schema";
import { ConflictResolver, type ConflictView } from "@/components/brain/conflict-resolver";

export default async function ConflictComparisonPage({
  params,
}: {
  params: Promise<{ clientId: string; conflictId: string }>;
}) {
  const { clientId, conflictId } = await params;
  const session = await requireClientAccess(clientId);
  const canResolve = can(session.user, "conflict.resolve", { clientId });

  const conflict = await getConflictById(conflictId);
  if (!conflict || conflict.clientId !== clientId) notFound();

  const existingValue = conflict.clientBrainItem.valueText ?? "";
  const proposedValue = conflict.extractedItem.normalizedValueText ?? "";
  const comparison = compareValues(conflict.clientBrainItem.fieldKey, existingValue, proposedValue);

  const view: ConflictView = {
    conflictId: conflict.id,
    clientId,
    fieldLabel: FIELD_LABELS[conflict.clientBrainItem.fieldKey],
    sectionLabel: SECTION_LABELS[conflict.clientBrainItem.sectionKey],
    changeType: comparison.changeType,
    detectedReason: conflict.detectedReason,
    existingValue,
    existingSource:
      conflict.clientBrainItem.sourceLinks[0]?.sourceId
        ? "Previously approved"
        : "Manually added",
    proposedValue,
    proposedSource: `${conflict.extractedItem.source.fileName} · ${conflict.extractedItem.sourceBlock.locationLabel}`,
  };

  const isResolved = conflict.status !== "OPEN";

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/c/${clientId}/brain/conflicts`}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All conflicts
      </Link>
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Version comparison
        </p>
        <h1 className="text-2xl font-semibold text-foreground">Resolve conflict</h1>
      </div>

      {isResolved ? (
        <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          This conflict has already been resolved.
        </p>
      ) : (
        <ConflictResolver conflict={view} canResolve={canResolve} />
      )}
    </div>
  );
}

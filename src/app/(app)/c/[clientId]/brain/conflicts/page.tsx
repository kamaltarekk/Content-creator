import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";

import { requireClientAccess } from "@/server/auth/permissions";
import { listConflictsForClient } from "@/server/services/conflict.service";
import { SECTION_LABELS, FIELD_LABELS } from "@/server/domain/brain-schema";
import { Badge } from "@/components/ui/badge";

export default async function ConflictsListPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);

  const conflicts = await listConflictsForClient(clientId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Client Brain</p>
        <h1 className="text-2xl font-semibold text-foreground">Open conflicts</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          A new source proposed a value that materially differs from approved strategy. Conflicts never
          overwrite automatically — resolve each one explicitly.
        </p>
      </div>

      {conflicts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No open conflicts</p>
          <p className="max-w-sm text-sm text-muted-foreground">Approved strategy is currently undisputed.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conflicts.map((conflict) => (
            <Link
              key={conflict.id}
              href={`/c/${clientId}/brain/conflicts/${conflict.id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-elevated/40"
            >
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {SECTION_LABELS[conflict.clientBrainItem.sectionKey]} ·{" "}
                  {FIELD_LABELS[conflict.clientBrainItem.fieldKey]}
                </p>
                <p className="truncate text-xs text-muted-foreground">{conflict.detectedReason}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(conflict.createdAt, { addSuffix: true })}
              </span>
              <Badge variant="warning">Open</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

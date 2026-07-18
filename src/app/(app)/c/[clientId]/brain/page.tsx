import Link from "next/link";

import { requireClientAccess, can } from "@/server/auth/permissions";
import { listBrainItems } from "@/server/services/clientBrain.service";
import { prisma } from "@/server/db/prisma";
import type { BrainItemView } from "@/types/brain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientBrainView } from "@/components/brain/client-brain-view";

export default async function ClientBrainPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const session = await requireClientAccess(clientId);
  const canEdit = can(session.user, "brain.edit.active", { clientId });

  const [items, openConflicts] = await Promise.all([
    listBrainItems(clientId),
    prisma.conflict.count({ where: { clientId, status: "OPEN" } }),
  ]);
  const view: BrainItemView[] = items.map((item) => ({
    id: item.id,
    sectionKey: item.sectionKey,
    fieldKey: item.fieldKey,
    groupId: item.groupId,
    subjectLabel: item.subjectLabel,
    valueText: item.valueText,
    status: item.status,
    confidence: item.confidence,
    currentVersionNumber: item.currentVersionNumber,
    hasSourceTrace: item.sourceLinks.length > 0,
    updatedAt: item.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Client Brain
          </p>
          <h1 className="text-2xl font-semibold text-foreground">Approved strategic knowledge</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/c/${clientId}/brain/conflicts`}>
              Conflicts
              {openConflicts > 0 && (
                <Badge variant="warning" className="ml-1.5">
                  {openConflicts}
                </Badge>
              )}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/c/${clientId}/brain/missing-data`}>Missing data report</Link>
          </Button>
        </div>
      </div>
      <ClientBrainView clientId={clientId} items={view} canEdit={canEdit} />
    </div>
  );
}

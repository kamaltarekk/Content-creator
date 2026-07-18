import "server-only";

import type {
  ClientBrainFieldKey,
  ClientBrainItem,
  ClientBrainSectionKey,
  Conflict,
  InformationType,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { compareValues, findExistingBrainItem } from "@/server/services/conflict.service";

export type ApplyApprovalInput = {
  extractedItemId: string;
  reviewerId: string;
  organizationId: string;
  sectionKey: ClientBrainSectionKey;
  fieldKey: ClientBrainFieldKey;
  valueText: string;
  informationType: InformationType;
  confidence: number | null;
  groupId?: string | null;
  subjectLabel?: string | null;
};

export type ApplyApprovalResult =
  | { status: "created"; item: ClientBrainItem }
  | { status: "updated"; item: ClientBrainItem }
  | { status: "conflict"; conflict: Conflict };

/**
 * Writes an approved extracted item into the Client Brain — but never
 * silently overwrites existing approved strategy. If a proposed value
 * materially conflicts with an existing ACTIVE item on the same field, a
 * Conflict record is created and the existing item is marked DISPUTED; the
 * write waits for explicit conflict resolution. Otherwise the item is created
 * (or a non-conflicting update produces a new version), always with a version
 * row, a source-traceability link, and an audit entry.
 */
export async function applyApproval(input: ApplyApprovalInput): Promise<ApplyApprovalResult> {
  const extracted = await prisma.extractedItem.findUniqueOrThrow({
    where: { id: input.extractedItemId },
    include: { sourceBlock: true },
  });
  const clientId = (await prisma.source.findUniqueOrThrow({ where: { id: extracted.sourceId } })).clientId;

  const existing = await findExistingBrainItem({
    clientId,
    sectionKey: input.sectionKey,
    fieldKey: input.fieldKey,
    groupId: input.groupId ?? undefined,
  });

  if (existing && existing.valueText) {
    const comparison = compareValues(input.fieldKey, existing.valueText, input.valueText);

    if (comparison.isConflict) {
      const conflict = await prisma.$transaction(async (tx) => {
        const created = await tx.conflict.create({
          data: {
            clientId,
            clientBrainItemId: existing.id,
            extractedItemId: input.extractedItemId,
            status: "OPEN",
            detectedReason: comparison.reason,
            similarityScore: comparison.similarity,
          },
        });
        await tx.clientBrainItem.update({ where: { id: existing.id }, data: { status: "DISPUTED" } });
        await tx.extractedItem.update({
          where: { id: input.extractedItemId },
          data: { isConflictCandidate: true },
        });
        return created;
      });

      await logAudit({
        organizationId: input.organizationId,
        clientId,
        actorUserId: input.reviewerId,
        action: "UPDATE",
        entityType: "Conflict",
        entityId: conflict.id,
        metadata: { fieldKey: input.fieldKey, reason: comparison.reason },
      });

      return { status: "conflict", conflict };
    }

    // Non-conflicting change: bump the value with a new version.
    const updated = await prisma.$transaction(async (tx) => {
      const nextVersion = existing.currentVersionNumber + 1;
      const item = await tx.clientBrainItem.update({
        where: { id: existing.id },
        data: {
          valueText: input.valueText,
          confidence: input.confidence,
          status: "ACTIVE",
          currentVersionNumber: nextVersion,
        },
      });
      await tx.clientBrainItemVersion.create({
        data: {
          clientBrainItemId: item.id,
          versionNumber: nextVersion,
          valueText: input.valueText,
          status: "ACTIVE",
          confidence: input.confidence,
          changeType: comparison.changeType === "UNCHANGED" ? "UNCHANGED" : "UPDATED",
          changedById: input.reviewerId,
          changeNote: comparison.reason,
        },
      });
      await tx.clientBrainItemSource.create({
        data: {
          clientBrainItemId: item.id,
          sourceId: extracted.sourceId,
          sourceBlockId: extracted.sourceBlockId,
          extractedItemId: extracted.id,
          approvedById: input.reviewerId,
        },
      });
      await tx.extractedItem.update({ where: { id: extracted.id }, data: { clientBrainItemId: item.id } });
      return item;
    });

    await logAudit({
      organizationId: input.organizationId,
      clientId,
      actorUserId: input.reviewerId,
      action: "APPROVE",
      entityType: "ClientBrainItem",
      entityId: updated.id,
      metadata: { fieldKey: input.fieldKey, change: "updated" },
    });

    return { status: "updated", item: updated };
  }

  // Fresh item.
  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.clientBrainItem.create({
      data: {
        clientId,
        sectionKey: input.sectionKey,
        fieldKey: input.fieldKey,
        groupId: input.groupId ?? undefined,
        subjectLabel: input.subjectLabel ?? null,
        valueText: input.valueText,
        status: "ACTIVE",
        confidence: input.confidence,
        currentVersionNumber: 1,
        createdById: input.reviewerId,
      },
    });
    await tx.clientBrainItemVersion.create({
      data: {
        clientBrainItemId: item.id,
        versionNumber: 1,
        valueText: input.valueText,
        status: "ACTIVE",
        confidence: input.confidence,
        changeType: "ADDED",
        changedById: input.reviewerId,
      },
    });
    await tx.clientBrainItemSource.create({
      data: {
        clientBrainItemId: item.id,
        sourceId: extracted.sourceId,
        sourceBlockId: extracted.sourceBlockId,
        extractedItemId: extracted.id,
        approvedById: input.reviewerId,
      },
    });
    await tx.extractedItem.update({ where: { id: extracted.id }, data: { clientBrainItemId: item.id } });
    return item;
  });

  await logAudit({
    organizationId: input.organizationId,
    clientId,
    actorUserId: input.reviewerId,
    action: "APPROVE",
    entityType: "ClientBrainItem",
    entityId: created.id,
    metadata: { fieldKey: input.fieldKey, change: "created" },
  });

  return { status: "created", item: created };
}

// ---- Manual Client Brain CRUD (used by the Client Brain UI) ----

export async function listBrainItems(clientId: string) {
  return prisma.clientBrainItem.findMany({
    where: { clientId, status: { not: "ARCHIVED" } },
    orderBy: [{ sectionKey: "asc" }, { groupId: "asc" }, { createdAt: "asc" }],
    include: {
      sourceLinks: true,
      _count: { select: { versions: true } },
    },
  });
}

export async function getBrainItem(itemId: string) {
  return prisma.clientBrainItem.findUnique({
    where: { id: itemId },
    include: {
      versions: { orderBy: { versionNumber: "desc" } },
      sourceLinks: true,
    },
  });
}

export async function createManualBrainItem(params: {
  clientId: string;
  organizationId: string;
  userId: string;
  sectionKey: ClientBrainSectionKey;
  fieldKey: ClientBrainFieldKey;
  valueText: string;
  subjectLabel?: string | null;
  groupId?: string | null;
}) {
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.clientBrainItem.create({
      data: {
        clientId: params.clientId,
        sectionKey: params.sectionKey,
        fieldKey: params.fieldKey,
        groupId: params.groupId ?? undefined,
        subjectLabel: params.subjectLabel ?? null,
        valueText: params.valueText,
        status: "ACTIVE",
        confidence: 1,
        currentVersionNumber: 1,
        createdById: params.userId,
      },
    });
    await tx.clientBrainItemVersion.create({
      data: {
        clientBrainItemId: created.id,
        versionNumber: 1,
        valueText: params.valueText,
        status: "ACTIVE",
        confidence: 1,
        changeType: "ADDED",
        changedById: params.userId,
        changeNote: "Added manually",
      },
    });
    return created;
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.userId,
    action: "CREATE",
    entityType: "ClientBrainItem",
    entityId: item.id,
    metadata: { fieldKey: params.fieldKey, manual: true },
  });

  return item;
}

export async function editBrainItem(params: {
  itemId: string;
  organizationId: string;
  userId: string;
  valueText: string;
}) {
  const existing = await prisma.clientBrainItem.findUniqueOrThrow({ where: { id: params.itemId } });
  const nextVersion = existing.currentVersionNumber + 1;

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.clientBrainItem.update({
      where: { id: params.itemId },
      data: { valueText: params.valueText, currentVersionNumber: nextVersion },
    });
    await tx.clientBrainItemVersion.create({
      data: {
        clientBrainItemId: params.itemId,
        versionNumber: nextVersion,
        valueText: params.valueText,
        status: updated.status,
        confidence: updated.confidence,
        changeType: "UPDATED",
        changedById: params.userId,
        changeNote: "Edited manually",
      },
    });
    return updated;
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: item.clientId,
    actorUserId: params.userId,
    action: "UPDATE",
    entityType: "ClientBrainItem",
    entityId: item.id,
  });

  return item;
}

export async function archiveBrainItem(params: { itemId: string; organizationId: string; userId: string }) {
  const item = await prisma.clientBrainItem.update({
    where: { id: params.itemId },
    data: { status: "ARCHIVED" },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: item.clientId,
    actorUserId: params.userId,
    action: "ARCHIVE",
    entityType: "ClientBrainItem",
    entityId: item.id,
  });

  return item;
}

export async function getSourceTrace(itemId: string) {
  const links = await prisma.clientBrainItemSource.findMany({
    where: { clientBrainItemId: itemId },
    orderBy: { approvedAt: "desc" },
  });

  const approverIds = Array.from(new Set(links.map((link) => link.approvedById)));
  const [approvers, blocks, sources] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, name: true } }),
    prisma.sourceBlock.findMany({
      where: { id: { in: links.map((l) => l.sourceBlockId).filter(Boolean) as string[] } },
    }),
    prisma.source.findMany({ where: { id: { in: links.map((l) => l.sourceId) } } }),
  ]);

  const approverMap = new Map(approvers.map((a) => [a.id, a.name]));
  const blockMap = new Map(blocks.map((b) => [b.id, b]));
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  return links.map((link) => ({
    ...link,
    approverName: approverMap.get(link.approvedById) ?? "Unknown",
    block: link.sourceBlockId ? (blockMap.get(link.sourceBlockId) ?? null) : null,
    source: sourceMap.get(link.sourceId) ?? null,
  }));
}

export type BrainItemWithMeta = Prisma.ClientBrainItemGetPayload<{
  include: { sourceLinks: true; _count: { select: { versions: true } } };
}>;

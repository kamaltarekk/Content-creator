"use server";

import { revalidatePath } from "next/cache";
import type { ClientBrainFieldKey, ClientBrainSectionKey } from "@prisma/client";

import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import {
  createManualBrainItem,
  editBrainItem,
  archiveBrainItem,
  getSourceTrace,
} from "@/server/services/clientBrain.service";

async function orgAndClientForItem(itemId: string) {
  const item = await prisma.clientBrainItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { clientId: true },
  });
  return item.clientId;
}

export async function createBrainItemAction(input: {
  clientId: string;
  sectionKey: ClientBrainSectionKey;
  fieldKey: ClientBrainFieldKey;
  valueText: string;
  subjectLabel?: string;
}) {
  const session = await requireAction("brain.edit.active", { clientId: input.clientId });
  if (!session.user.orgId) throw new Error("No organization on account.");

  const value = input.valueText.trim();
  if (!value) throw new Error("A value is required.");

  await createManualBrainItem({
    clientId: input.clientId,
    organizationId: session.user.orgId,
    userId: session.user.id,
    sectionKey: input.sectionKey,
    fieldKey: input.fieldKey,
    valueText: value,
    subjectLabel: input.subjectLabel || null,
  });

  revalidatePath(`/c/${input.clientId}/brain`);
}

export async function editBrainItemAction(itemId: string, valueText: string) {
  const clientId = await orgAndClientForItem(itemId);
  const session = await requireAction("brain.edit.active", { clientId });
  if (!session.user.orgId) throw new Error("No organization on account.");

  const value = valueText.trim();
  if (!value) throw new Error("A value is required.");

  await editBrainItem({
    itemId,
    organizationId: session.user.orgId,
    userId: session.user.id,
    valueText: value,
  });

  revalidatePath(`/c/${clientId}/brain`);
}

export async function archiveBrainItemAction(itemId: string) {
  const clientId = await orgAndClientForItem(itemId);
  const session = await requireAction("brain.edit.active", { clientId });
  if (!session.user.orgId) throw new Error("No organization on account.");

  await archiveBrainItem({ itemId, organizationId: session.user.orgId, userId: session.user.id });
  revalidatePath(`/c/${clientId}/brain`);
}

export async function getSourceTraceAction(itemId: string) {
  const clientId = await orgAndClientForItem(itemId);
  await requireAction("brain.view", { clientId });

  const trace = await getSourceTrace(itemId);
  return trace.map((link) => ({
    id: link.id,
    sourceId: link.sourceId,
    sourceFileName: link.source?.fileName ?? "Unknown source",
    sourceLocationLabel: link.block?.locationLabel ?? null,
    originalText: link.block?.rawText ?? null,
    approverName: link.approverName,
    approvedAt: link.approvedAt.toISOString(),
  }));
}

export async function getVersionHistoryAction(itemId: string) {
  const clientId = await orgAndClientForItem(itemId);
  await requireAction("brain.view", { clientId });

  const versions = await prisma.clientBrainItemVersion.findMany({
    where: { clientBrainItemId: itemId },
    orderBy: { versionNumber: "desc" },
  });

  const changerIds = Array.from(new Set(versions.map((v) => v.changedById)));
  const users = await prisma.user.findMany({
    where: { id: { in: changerIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  return versions.map((version) => ({
    versionNumber: version.versionNumber,
    valueText: version.valueText,
    changeType: version.changeType,
    changeNote: version.changeNote,
    changedByName: nameMap.get(version.changedById) ?? "Unknown",
    createdAt: version.createdAt.toISOString(),
  }));
}

import "server-only";

import type { EvidenceStrength, StrategicEntityType } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
export { evidenceState, type EvidenceState } from "@/server/domain/evidence";

function orNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

/**
 * Lightweight evidence linking (spec: the full Evidence/Claims Vault is a
 * later module). Links a described piece of evidence — optionally traced to
 * an existing Client Brain PROOF/EVIDENCE item — to any strategy entity.
 * `beliefMapId` is populated whenever the target is a belief map, so the
 * belief detail page can query its evidence directly.
 */
export async function addEvidenceLink(params: {
  clientId: string;
  organizationId: string;
  actorUserId: string;
  targetEntityType: StrategicEntityType;
  targetEntityId: string;
  beliefMapId?: string | null;
  input: {
    description: string;
    evidenceStrength?: EvidenceStrength;
    clientBrainItemId?: string | null;
    note?: string | null;
  };
}) {
  const link = await prisma.evidenceLink.create({
    data: {
      clientId: params.clientId,
      targetEntityType: params.targetEntityType,
      targetEntityId: params.targetEntityId,
      beliefMapId: params.beliefMapId ?? null,
      description: params.input.description,
      evidenceStrength: params.input.evidenceStrength ?? "WEAK",
      clientBrainItemId: orNull(params.input.clientBrainItemId),
      note: orNull(params.input.note),
      createdById: params.actorUserId,
    },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.actorUserId,
    action: "CREATE",
    entityType: "EvidenceLink",
    entityId: link.id,
    metadata: { targetEntityType: params.targetEntityType, targetEntityId: params.targetEntityId },
  });

  return link;
}

export async function removeEvidenceLink(params: { evidenceLinkId: string; organizationId: string; actorUserId: string }) {
  const link = await prisma.evidenceLink.findUniqueOrThrow({ where: { id: params.evidenceLinkId } });
  await prisma.evidenceLink.delete({ where: { id: params.evidenceLinkId } });

  await logAudit({
    organizationId: params.organizationId,
    clientId: link.clientId,
    actorUserId: params.actorUserId,
    action: "SOFT_DELETE",
    entityType: "EvidenceLink",
    entityId: link.id,
  });

  return link;
}


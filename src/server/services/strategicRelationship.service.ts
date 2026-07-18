import "server-only";

import type { StrategicRelationshipType } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";

/** Thrown when a relationship (or its removal) would cross client boundaries — client isolation is absolute. */
export class CrossClientRelationshipError extends Error {
  constructor(message = "Cannot relate entities across different clients.") {
    super(message);
    this.name = "CrossClientRelationshipError";
  }
}

/**
 * Creates a relationship between two StrategicEntity reference rows.
 * Cross-client relationships are rejected server-side — client isolation is
 * absolute even at the graph layer, regardless of what the UI sends.
 */
export async function createStrategicRelationship(params: {
  clientId: string;
  organizationId: string;
  actorUserId: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: StrategicRelationshipType;
  note?: string | null;
}) {
  if (params.fromEntityId === params.toEntityId) {
    throw new Error("An entity cannot be related to itself.");
  }

  const [fromEntity, toEntity] = await Promise.all([
    prisma.strategicEntity.findUniqueOrThrow({ where: { id: params.fromEntityId } }),
    prisma.strategicEntity.findUniqueOrThrow({ where: { id: params.toEntityId } }),
  ]);

  if (fromEntity.clientId !== params.clientId || toEntity.clientId !== params.clientId) {
    throw new CrossClientRelationshipError();
  }

  const relationship = await prisma.strategicRelationship.create({
    data: {
      clientId: params.clientId,
      fromEntityId: params.fromEntityId,
      toEntityId: params.toEntityId,
      relationshipType: params.relationshipType,
      note: params.note ?? null,
      createdById: params.actorUserId,
    },
  });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.actorUserId,
    action: "CREATE",
    entityType: "StrategicRelationship",
    entityId: relationship.id,
    metadata: { fromEntityId: params.fromEntityId, toEntityId: params.toEntityId, relationshipType: params.relationshipType },
  });

  return relationship;
}

export async function removeStrategicRelationship(params: { relationshipId: string; clientId: string; organizationId: string; actorUserId: string }) {
  const relationship = await prisma.strategicRelationship.findUniqueOrThrow({ where: { id: params.relationshipId } });
  if (relationship.clientId !== params.clientId) {
    throw new CrossClientRelationshipError("Cannot remove a relationship belonging to a different client.");
  }

  await prisma.strategicRelationship.delete({ where: { id: params.relationshipId } });

  await logAudit({
    organizationId: params.organizationId,
    clientId: params.clientId,
    actorUserId: params.actorUserId,
    action: "SOFT_DELETE",
    entityType: "StrategicRelationship",
    entityId: relationship.id,
  });

  return relationship;
}

export function listStrategicEntities(clientId: string) {
  return prisma.strategicEntity.findMany({
    where: { clientId },
    orderBy: [{ entityType: "asc" }, { title: "asc" }],
  });
}

export async function listStrategicRelationships(clientId: string) {
  const relationships = await prisma.strategicRelationship.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: { fromEntity: true, toEntity: true },
  });
  return relationships;
}

import "server-only";

import type { StrategicEntityType } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

/**
 * Thin reference-layer helper for the Strategic Relationship Graph (spec
 * tool H). Every strategy entity (cohort, situation, decision, belief, ...)
 * upserts a denormalized StrategicEntity row on create/rename so relationships
 * can reference a single, uniform table without duplicating real data.
 */
export async function upsertStrategicEntity(params: {
  clientId: string;
  entityType: StrategicEntityType;
  entityId: string;
  title: string;
  status?: string | null;
}) {
  return prisma.strategicEntity.upsert({
    where: {
      clientId_entityType_entityId: {
        clientId: params.clientId,
        entityType: params.entityType,
        entityId: params.entityId,
      },
    },
    create: {
      clientId: params.clientId,
      entityType: params.entityType,
      entityId: params.entityId,
      title: params.title,
      status: params.status ?? null,
    },
    update: {
      title: params.title,
      status: params.status ?? null,
    },
  });
}

/** Removes the reference-layer row (and, transactionally, any relationships pointing at it) when an entity is archived. */
export async function removeStrategicEntity(params: { clientId: string; entityType: StrategicEntityType; entityId: string }) {
  const entity = await prisma.strategicEntity.findUnique({
    where: {
      clientId_entityType_entityId: {
        clientId: params.clientId,
        entityType: params.entityType,
        entityId: params.entityId,
      },
    },
  });
  if (!entity) return null;

  await prisma.$transaction(async (tx) => {
    await tx.strategicRelationship.deleteMany({
      where: { OR: [{ fromEntityId: entity.id }, { toEntityId: entity.id }] },
    });
    await tx.strategicEntity.delete({ where: { id: entity.id } });
  });

  return entity;
}

"use server";

import { revalidatePath } from "next/cache";
import type { StrategicRelationshipType } from "@prisma/client";

import { requireAction } from "@/server/auth/permissions";
import * as relationshipService from "@/server/services/strategicRelationship.service";

export async function createStrategicRelationshipAction(
  clientId: string,
  input: { fromEntityId: string; toEntityId: string; relationshipType: StrategicRelationshipType; note?: string },
) {
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await relationshipService.createStrategicRelationship({
    clientId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    fromEntityId: input.fromEntityId,
    toEntityId: input.toEntityId,
    relationshipType: input.relationshipType,
    note: input.note,
  });

  revalidatePath(`/c/${clientId}/strategy/relationships`);
}

export async function removeStrategicRelationshipAction(relationshipId: string, clientId: string) {
  const session = await requireAction("strategy.edit", { clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  await relationshipService.removeStrategicRelationship({
    relationshipId,
    clientId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
  });

  revalidatePath(`/c/${clientId}/strategy/relationships`);
}

export async function listStrategicEntitiesAction(clientId: string) {
  await requireAction("strategy.view", { clientId });
  return relationshipService.listStrategicEntities(clientId);
}

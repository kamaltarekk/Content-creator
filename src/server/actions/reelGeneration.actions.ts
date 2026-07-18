"use server";

import { revalidatePath } from "next/cache";
import type { ContentObjective, ReelPlatform, RequestedStyle } from "@prisma/client";

import { requireAction } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { compileScriptContext } from "@/server/services/scriptContextCompiler.service";
import { generateReelScript } from "@/server/services/reelScriptGeneration.service";
import { createReelGeneration, getReelGenerationWithContext } from "@/server/services/reelScriptVersion.service";
import { applyHookSelection, applyScriptEdit, regenerateReel } from "@/server/services/reelScriptEdit.service";
import { inferStrategicDirection } from "@/server/domain/strategic-direction";
import type { ScriptSegment } from "@/server/domain/reel-script-package";

async function assertReelBelongsToClient(reelGenerationId: string, clientId: string) {
  const generation = await prisma.reelGeneration.findUniqueOrThrow({ where: { id: reelGenerationId } });
  if (generation.clientId !== clientId) throw new Error("This Reel does not belong to this client.");
}

export async function previewStrategicDirectionAction(input: { clientId: string; cohortId: string; contentObjective: ContentObjective; platform: ReelPlatform }) {
  await requireAction("reel.generate", { clientId: input.clientId });
  const { context, warnings } = await compileScriptContext(input);
  return { direction: inferStrategicDirection(context), warnings, cohortName: context.audience.cohortName };
}

export async function createFirstReelAction(input: {
  clientId: string;
  cohortId: string;
  contentObjective: ContentObjective;
  platform: ReelPlatform;
  requestedStyle?: RequestedStyle;
}) {
  const session = await requireAction("reel.generate", { clientId: input.clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");

  const generated = await generateReelScript({
    clientId: input.clientId,
    cohortId: input.cohortId,
    contentObjective: input.contentObjective,
    platform: input.platform,
    requestedStyle: input.requestedStyle,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
  });

  const created = await createReelGeneration({
    clientId: input.clientId,
    cohortId: input.cohortId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    contextSnapshotId: generated.snapshotId,
    package: generated.package,
    validation: generated.validation,
  });

  revalidatePath(`/c/${input.clientId}/brain`);
  return { generationId: created.generationId };
}

export async function getReelResultAction(clientId: string, reelGenerationId: string) {
  await requireAction("reel.generate", { clientId });
  const { generation, latestVersion, package: pkg } = await getReelGenerationWithContext(reelGenerationId);
  if (generation.clientId !== clientId) throw new Error("This Reel does not belong to this client.");
  return { generation, latestVersion, package: pkg };
}

export async function changeSelectedHookAction(input: { clientId: string; reelGenerationId: string; hookIndex: number }) {
  const session = await requireAction("reel.generate", { clientId: input.clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");
  await assertReelBelongsToClient(input.reelGenerationId, input.clientId);

  const result = await applyHookSelection({
    reelGenerationId: input.reelGenerationId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    hookIndex: input.hookIndex,
  });

  revalidatePath(`/c/${input.clientId}/reels/${input.reelGenerationId}`);
  return result;
}

export async function editReelScriptAction(input: { clientId: string; reelGenerationId: string; segments: ScriptSegment[] }) {
  const session = await requireAction("reel.generate", { clientId: input.clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");
  await assertReelBelongsToClient(input.reelGenerationId, input.clientId);

  const result = await applyScriptEdit({
    reelGenerationId: input.reelGenerationId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
    segments: input.segments,
  });

  revalidatePath(`/c/${input.clientId}/reels/${input.reelGenerationId}`);
  return result;
}

export async function regenerateReelAction(input: { clientId: string; reelGenerationId: string }) {
  const session = await requireAction("reel.generate", { clientId: input.clientId });
  if (!session.user.orgId) throw new Error("Your account is not attached to an organization.");
  await assertReelBelongsToClient(input.reelGenerationId, input.clientId);

  const result = await regenerateReel({
    clientId: input.clientId,
    reelGenerationId: input.reelGenerationId,
    organizationId: session.user.orgId,
    actorUserId: session.user.id,
  });

  revalidatePath(`/c/${input.clientId}/reels/${input.reelGenerationId}`);
  return result;
}

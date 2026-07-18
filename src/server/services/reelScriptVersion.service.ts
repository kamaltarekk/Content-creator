import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { getScriptGenerationContext } from "@/server/services/scriptContextSnapshot.service";
import { ReelScriptPackageSchema, type ReelScriptPackage } from "@/server/domain/reel-script-package";
import type { ReelValidationResult } from "@/server/domain/reel-validation";

export type CreateReelGenerationInput = {
  clientId: string;
  cohortId: string;
  organizationId: string;
  actorUserId: string;
  contextSnapshotId: string;
  package: ReelScriptPackage;
  validation: ReelValidationResult;
};

/** Creates a new ReelGeneration with its first ReelVersion (version 1). Status is READY only if every gate passed or was overridden. */
export async function createReelGeneration(input: CreateReelGenerationInput) {
  const status = input.validation.readyToMarkReady ? "READY" : "DRAFT";

  const { generation, version } = await prisma.$transaction(async (tx) => {
    const generation = await tx.reelGeneration.create({
      data: {
        clientId: input.clientId,
        cohortId: input.cohortId,
        contextSnapshotId: input.contextSnapshotId,
        status,
        currentVersionNumber: 1,
        createdById: input.actorUserId,
      },
    });
    const version = await tx.reelVersion.create({
      data: {
        reelGenerationId: generation.id,
        packageJson: input.package as unknown as Prisma.InputJsonValue,
        selectedHookIndex: input.package.selectedHookIndex,
        validationJson: input.validation as unknown as Prisma.InputJsonValue,
        versionNumber: 1,
        createdById: input.actorUserId,
      },
    });
    return { generation, version };
  });

  await logAudit({
    organizationId: input.organizationId,
    clientId: input.clientId,
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "ReelGeneration",
    entityId: generation.id,
    metadata: { status, versionNumber: 1 },
  });

  return { generationId: generation.id, versionId: version.id, status };
}

export type CreateReelVersionInput = {
  reelGenerationId: string;
  organizationId: string;
  actorUserId: string;
  package: ReelScriptPackage;
  validation: ReelValidationResult;
  changeNote?: string;
};

/** Adds a new version to an existing ReelGeneration (e.g. "Make it shorter", hook change) — never edits a past version in place. */
export async function createReelVersion(input: CreateReelVersionInput) {
  const status = input.validation.readyToMarkReady ? "READY" : "DRAFT";

  const { generation, version } = await prisma.$transaction(async (tx) => {
    const current = await tx.reelGeneration.findUniqueOrThrow({ where: { id: input.reelGenerationId } });
    const nextVersion = current.currentVersionNumber + 1;
    const version = await tx.reelVersion.create({
      data: {
        reelGenerationId: input.reelGenerationId,
        packageJson: input.package as unknown as Prisma.InputJsonValue,
        selectedHookIndex: input.package.selectedHookIndex,
        validationJson: input.validation as unknown as Prisma.InputJsonValue,
        versionNumber: nextVersion,
        changeNote: input.changeNote ?? null,
        createdById: input.actorUserId,
      },
    });
    const generation = await tx.reelGeneration.update({
      where: { id: input.reelGenerationId },
      data: { currentVersionNumber: nextVersion, status },
    });
    return { generation, version };
  });

  await logAudit({
    organizationId: input.organizationId,
    clientId: generation.clientId,
    actorUserId: input.actorUserId,
    action: "UPDATE",
    entityType: "ReelGeneration",
    entityId: generation.id,
    metadata: { status, versionNumber: version.versionNumber, changeNote: input.changeNote ?? null },
  });

  return { generationId: generation.id, versionId: version.id, versionNumber: version.versionNumber, status };
}

export async function getReelGeneration(reelGenerationId: string) {
  return prisma.reelGeneration.findUniqueOrThrow({
    where: { id: reelGenerationId },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });
}

export async function getLatestReelVersion(reelGenerationId: string) {
  return prisma.reelVersion.findFirstOrThrow({
    where: { reelGenerationId },
    orderBy: { versionNumber: "desc" },
  });
}

export async function listReelGenerationsForClient(clientId: string) {
  return prisma.reelGeneration.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
}

/** Loads a generation's latest package plus the exact authorized context it was grounded in — needed to re-validate any edit or hook change. */
export async function getReelGenerationWithContext(reelGenerationId: string) {
  const generation = await prisma.reelGeneration.findUniqueOrThrow({ where: { id: reelGenerationId } });
  const latestVersion = await getLatestReelVersion(reelGenerationId);
  const context = await getScriptGenerationContext(generation.contextSnapshotId);
  const pkg = ReelScriptPackageSchema.parse(latestVersion.packageJson);
  return { generation, latestVersion, context, package: pkg };
}

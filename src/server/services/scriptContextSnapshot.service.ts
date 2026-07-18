import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { logAudit } from "@/server/services/audit.service";
import { ScriptGenerationContextSchema, type ScriptGenerationContext } from "@/server/domain/script-generation-context";

export type CreateScriptContextSnapshotInput = {
  clientId: string;
  cohortId: string;
  organizationId: string;
  actorUserId: string;
  generationPurpose: string;
  context: ScriptGenerationContext;
  readiness: Prisma.InputJsonValue;
  warnings: string[];
};

/**
 * Persists a compiled ScriptGenerationContext as an immutable, versioned
 * snapshot (spec section 24: "produces ... an immutable versioned
 * snapshot"). Snapshots are never edited in place — a new Reel request
 * always compiles and stores a fresh one, so every past Reel generation can
 * be traced back to exactly the authorized data it was grounded in.
 */
export async function createScriptContextSnapshot(input: CreateScriptContextSnapshotInput) {
  const snapshot = await prisma.scriptContextSnapshot.create({
    data: {
      clientId: input.clientId,
      cohortId: input.cohortId,
      generationPurpose: input.generationPurpose,
      compiledContext: input.context as unknown as Prisma.InputJsonValue,
      sourceManifest: input.context.grounding.sourceReferences,
      readiness: input.readiness,
      warnings: input.warnings,
      createdById: input.actorUserId,
    },
  });

  await logAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "ScriptContextSnapshot",
    entityId: snapshot.id,
    clientId: input.clientId,
    metadata: { cohortId: input.cohortId, warningCount: input.warnings.length },
  });

  return snapshot;
}

export async function getScriptContextSnapshot(snapshotId: string) {
  return prisma.scriptContextSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
}

/** Re-parses a persisted snapshot's compiled context, validating it still matches the strict schema. */
export async function getScriptGenerationContext(snapshotId: string): Promise<ScriptGenerationContext> {
  const snapshot = await getScriptContextSnapshot(snapshotId);
  return ScriptGenerationContextSchema.parse(snapshot.compiledContext);
}

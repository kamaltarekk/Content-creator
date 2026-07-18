import "server-only";

import type { Prisma, RequestedStyle } from "@prisma/client";

import { getAIProvider } from "@/server/providers/ai/openai.provider";
import type { AIProvider } from "@/server/providers/ai/ai.provider";
import { compileScriptContext, type CompileScriptContextInput } from "@/server/services/scriptContextCompiler.service";
import { createScriptContextSnapshot } from "@/server/services/scriptContextSnapshot.service";
import { ReelScriptPackageSchema, type ReelScriptPackage } from "@/server/domain/reel-script-package";
import { computeReelValidation, isReadyToMarkReady, summarizeGatesForPackage } from "@/server/domain/reel-validation";
import type { ReelValidationResult } from "@/server/domain/reel-validation";

export type GenerateReelScriptInput = CompileScriptContextInput & {
  organizationId: string;
  actorUserId: string;
  requestedStyle?: RequestedStyle;
  providerOverride?: AIProvider;
};

export type GenerateReelScriptResult = {
  package: ReelScriptPackage;
  validation: ReelValidationResult;
  warnings: string[];
  snapshotId: string;
};

/**
 * Generates one complete Reel script package: compiles the authorized
 * ScriptGenerationContext, persists it as an immutable snapshot, asks the
 * AI generation layer for a draft (the ONLY thing it ever sees is the
 * compiled context), validates the draft against the strict schema, runs it
 * through all 8 validation gates, and assembles the final ReelScriptPackage
 * with deterministic meta/sources/audits — never trusting anything the
 * model claims about itself.
 */
export async function generateReelScript(input: GenerateReelScriptInput): Promise<GenerateReelScriptResult> {
  const { context, warnings: compilerWarnings } = await compileScriptContext(input);

  const snapshot = await createScriptContextSnapshot({
    clientId: input.clientId,
    cohortId: input.cohortId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    generationPurpose: `reel:${input.contentObjective}`,
    context,
    readiness: { warnings: compilerWarnings } as Prisma.InputJsonValue,
    warnings: compilerWarnings,
  });

  const provider = input.providerOverride ?? getAIProvider();
  const draft = await provider.generateReelScript(context, { requestedStyle: input.requestedStyle });

  const draftPackage: ReelScriptPackage = {
    meta: {
      packageId: `pkg_${snapshot.id}`,
      clientId: input.clientId,
      cohortId: context.meta.cohortId,
      contextSnapshotId: snapshot.id,
      generatedAt: new Date().toISOString(),
      contentObjective: input.contentObjective,
      platform: input.platform,
    },
    strategy: draft.strategy,
    hookOptions: draft.hookOptions,
    selectedHookIndex: draft.selectedHookIndex,
    script: draft.script,
    production: draft.production,
    commercial: draft.commercial,
    audits: {
      strategicGrounding: { status: "PASS", note: "pending" },
      voiceAlignment: { status: "PASS", note: "pending" },
      claimSafety: { status: "PASS", note: "pending" },
      comprehension: { status: "PASS", note: "pending" },
      platformFit: { status: "PASS", note: "pending" },
      productionFeasibility: { status: "PASS", note: "pending" },
    },
    sources: context.grounding.sourceReferences.map((ref) => ({ entityType: ref.entityType, entityId: ref.entityId, field: ref.field })),
    warnings: compilerWarnings,
    optionalAlternatives: draft.optionalAlternatives,
  };

  const gates = computeReelValidation(context, draftPackage);
  const validation: ReelValidationResult = { gates, readyToMarkReady: isReadyToMarkReady(gates, []), overrides: [] };
  const pkg: ReelScriptPackage = { ...draftPackage, audits: summarizeGatesForPackage(gates) };

  ReelScriptPackageSchema.parse(pkg);

  return { package: pkg, validation, warnings: compilerWarnings, snapshotId: snapshot.id };
}

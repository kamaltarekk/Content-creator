import "server-only";

import type { Prisma } from "@prisma/client";

import { getAIProvider } from "@/server/providers/ai/openai.provider";
import type { AIProvider } from "@/server/providers/ai/ai.provider";
import { compileScriptContext, type CompileScriptContextInput } from "@/server/services/scriptContextCompiler.service";
import { createScriptContextSnapshot } from "@/server/services/scriptContextSnapshot.service";
import { ReelScriptPackageSchema, type ReelScriptPackage, type AuditResult } from "@/server/domain/reel-script-package";
import type { ScriptGenerationContext } from "@/server/domain/script-generation-context";
import type { ReelScriptDraft } from "@/server/domain/reel-script-package";

export type GenerateReelScriptInput = CompileScriptContextInput & {
  organizationId: string;
  actorUserId: string;
  providerOverride?: AIProvider;
};

export type GenerateReelScriptResult = {
  package: ReelScriptPackage;
  warnings: string[];
  snapshotId: string;
};

const MAX_REELS_DURATION_SECONDS = 90;
const LONG_SEGMENT_CHAR_THRESHOLD = 420;

function pass(note: string): AuditResult {
  return { status: "PASS", note };
}
function warn(note: string): AuditResult {
  return { status: "WARNING", note };
}
function fail(note: string): AuditResult {
  return { status: "FAIL", note };
}

/**
 * A first-pass audit computation built from signals already available at
 * generation time. This is intentionally lightweight — reelScriptValidationService
 * (Reel validation gates milestone) supersedes it with the full 8-gate
 * pipeline (adding CTA fit and a real duration/comprehension pass) and
 * becomes the authoritative source before a Reel can be marked Ready; this
 * function only keeps the package internally consistent in the meantime.
 */
function computePreliminaryAudits(context: ScriptGenerationContext, draft: ReelScriptDraft): ReelScriptPackage["audits"] {
  const strategicGrounding =
    context.beliefChain || context.request.contentObjective !== "BELIEF_CHANGE"
      ? pass("The script is grounded in the compiled audience and belief context.")
      : warn("No approved belief chain exists for this audience, but the objective is to change a belief.");

  const voiceAlignment =
    context.voice.language && context.voice.tones.length > 0
      ? pass("Voice (language and tone) is grounded in approved Client Brain data.")
      : warn("Voice guidance is incomplete — some tone or language data is missing.");

  const claimSafety =
    draft.commercial.claimStatus === "APPROVED" && context.proof.length === 0
      ? fail("The script claims verified results but no approved public proof exists.")
      : draft.commercial.claimStatus === "RESTRICTED"
        ? warn("This script uses a restricted claim — review before publishing.")
        : pass("No claim exceeds what the approved context supports.");

  const longSegment = draft.script.segments.some((segment) => segment.text.length > LONG_SEGMENT_CHAR_THRESHOLD);
  const comprehension = longSegment
    ? warn("At least one segment is long — consider shortening for spoken delivery.")
    : pass("Segment lengths are reasonable for spoken delivery.");

  const platformFit =
    draft.script.estimatedDurationSeconds > MAX_REELS_DURATION_SECONDS
      ? warn(`Estimated duration (${Math.round(draft.script.estimatedDurationSeconds)}s) is long for ${context.request.platform}.`)
      : pass(`Duration and format fit ${context.request.platform}.`);

  const productionFeasibility =
    draft.production.editingLevel === "ADVANCED" && context.execution.editingLevel && context.execution.editingLevel !== "ADVANCED"
      ? warn("This script assumes advanced editing capacity beyond what's on record for this client.")
      : pass("Production requirements match the client's known capacity.");

  return { strategicGrounding, voiceAlignment, claimSafety, comprehension, platformFit, productionFeasibility };
}

/**
 * Generates one complete Reel script package: compiles the authorized
 * ScriptGenerationContext, persists it as an immutable snapshot, asks the
 * AI generation layer for a draft (the ONLY thing it ever sees is the
 * compiled context), validates the draft against the strict schema, and
 * assembles the final ReelScriptPackage with deterministic meta/sources/
 * audits — never trusting anything the model claims about itself.
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
  const draft = await provider.generateReelScript(context);

  const audits = computePreliminaryAudits(context, draft);

  const pkg: ReelScriptPackage = {
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
    audits,
    sources: context.grounding.sourceReferences.map((ref) => ({ entityType: ref.entityType, entityId: ref.entityId, field: ref.field })),
    warnings: compilerWarnings,
    optionalAlternatives: draft.optionalAlternatives,
  };

  ReelScriptPackageSchema.parse(pkg);

  return { package: pkg, warnings: compilerWarnings, snapshotId: snapshot.id };
}

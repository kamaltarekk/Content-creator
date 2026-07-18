import "server-only";

import { prisma } from "@/server/db/prisma";
import { computeReelValidation, isReadyToMarkReady, summarizeGatesForPackage } from "@/server/domain/reel-validation";
import type { ScriptSegment } from "@/server/domain/reel-script-package";
import type { AIProvider } from "@/server/providers/ai/ai.provider";
import { generateReelScript } from "@/server/services/reelScriptGeneration.service";
import { getReelGenerationWithContext, createReelVersion } from "@/server/services/reelScriptVersion.service";

export type ApplyHookSelectionInput = {
  reelGenerationId: string;
  organizationId: string;
  actorUserId: string;
  hookIndex: number;
};

/** Improvement Action "Change the hook" — deterministic, no AI call: swaps the selected hook and its text into the script's opening HOOK segment. */
export async function applyHookSelection(input: ApplyHookSelectionInput) {
  const { context, package: current } = await getReelGenerationWithContext(input.reelGenerationId);

  const chosenHook = current.hookOptions[input.hookIndex];
  if (!chosenHook) throw new Error("That hook option doesn't exist.");

  const segments = current.script.segments.map((segment, i) => (segment.type === "HOOK" && i === 0 ? { ...segment, text: chosenHook.text } : segment));
  const updatedPackage = { ...current, selectedHookIndex: input.hookIndex, script: { ...current.script, segments } };

  const gates = computeReelValidation(context, updatedPackage);
  const validation = { gates, readyToMarkReady: isReadyToMarkReady(gates, []), overrides: [] };
  const finalPackage = { ...updatedPackage, audits: summarizeGatesForPackage(gates) };

  return createReelVersion({
    reelGenerationId: input.reelGenerationId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    package: finalPackage,
    validation,
    changeNote: `Switched to hook option ${input.hookIndex + 1}.`,
  });
}

export type ApplyScriptEditInput = {
  reelGenerationId: string;
  organizationId: string;
  actorUserId: string;
  segments: ScriptSegment[];
};

/** Improvement Action "Edit the script" — a manual user edit, re-validated and versioned like any other change. */
export async function applyScriptEdit(input: ApplyScriptEditInput) {
  const { context, package: current } = await getReelGenerationWithContext(input.reelGenerationId);

  const fullText = input.segments.map((s) => s.text).join(" ");
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const estimatedDurationSeconds = input.segments.reduce((sum, s) => sum + s.estimatedSeconds, 0);
  const updatedPackage = { ...current, script: { segments: input.segments, fullText, wordCount, estimatedDurationSeconds } };

  const gates = computeReelValidation(context, updatedPackage);
  const validation = { gates, readyToMarkReady: isReadyToMarkReady(gates, []), overrides: [] };
  const finalPackage = { ...updatedPackage, audits: summarizeGatesForPackage(gates) };

  return createReelVersion({
    reelGenerationId: input.reelGenerationId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    package: finalPackage,
    validation,
    changeNote: "Edited the spoken script.",
  });
}

export type RegenerateReelInput = {
  clientId: string;
  reelGenerationId: string;
  organizationId: string;
  actorUserId: string;
  providerOverride?: AIProvider;
};

/** Improvement Action "Regenerate" — reruns the whole generation from the same client/cohort/objective, producing a fresh version. */
export async function regenerateReel(input: RegenerateReelInput) {
  const generation = await prisma.reelGeneration.findUniqueOrThrow({ where: { id: input.reelGenerationId } });
  const { package: current } = await getReelGenerationWithContext(input.reelGenerationId);

  const generated = await generateReelScript({
    clientId: input.clientId,
    cohortId: generation.cohortId,
    contentObjective: current.meta.contentObjective,
    platform: current.meta.platform,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    providerOverride: input.providerOverride,
  });

  return createReelVersion({
    reelGenerationId: input.reelGenerationId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    package: generated.package,
    validation: generated.validation,
    changeNote: "Regenerated the Reel from the current authorized context.",
  });
}

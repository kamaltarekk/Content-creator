import "server-only";

import { logAudit } from "@/server/services/audit.service";
import {
  computeReelValidation,
  isReadyToMarkReady,
  type ReelValidationResult,
  type ValidationGateKey,
  type ValidationOverride,
} from "@/server/domain/reel-validation";
import type { ReelScriptPackage } from "@/server/domain/reel-script-package";
import type { ScriptGenerationContext } from "@/server/domain/script-generation-context";

export type { ReelValidationResult, ValidationGateKey, ValidationOverride } from "@/server/domain/reel-validation";

/** Runs all 8 validation gates and folds in any previously authorized overrides. */
export function validateReelScript(
  context: ScriptGenerationContext,
  pkg: ReelScriptPackage,
  overrides: ValidationOverride[] = [],
): ReelValidationResult {
  const gates = computeReelValidation(context, pkg);
  return { gates, readyToMarkReady: isReadyToMarkReady(gates, overrides), overrides };
}

export type RecordValidationOverrideInput = {
  organizationId: string;
  clientId: string;
  actorUserId: string;
  gateKey: ValidationGateKey;
  reason: string;
};

/**
 * Records an authorized override for one failing/warning gate (spec: "allow
 * authorized override only with reason/user/timestamp/audit log"). This
 * never changes the gate's own computed status — computeReelValidation is
 * never told to lie — it only lets isReadyToMarkReady treat that specific
 * gate as satisfied, with a permanent audit trail of who did it and why.
 */
export async function recordValidationOverride(input: RecordValidationOverrideInput): Promise<ValidationOverride> {
  if (!input.reason.trim()) throw new Error("An override requires a reason.");

  const override: ValidationOverride = {
    gateKey: input.gateKey,
    reason: input.reason,
    overriddenBy: input.actorUserId,
    overriddenAt: new Date().toISOString(),
  };

  await logAudit({
    organizationId: input.organizationId,
    clientId: input.clientId,
    actorUserId: input.actorUserId,
    action: "APPROVE",
    entityType: "ReelValidationGate",
    entityId: input.gateKey,
    metadata: { reason: input.reason },
  });

  return override;
}

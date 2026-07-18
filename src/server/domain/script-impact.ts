import type { ScriptImpact } from "@prisma/client";

/**
 * The primary product rule (spec section 2): never ask for or import a field
 * unless it changes at least one of AUDIENCE/HOOK/ANGLE/STORY/BODY/EXAMPLE/
 * PROOF/REFRAME/VOICE/CTA/FORMAT/VISUAL/SAFETY/LEARNING — or is SYSTEM_ONLY
 * and operationally necessary. This is the single deterministic gate every
 * question definition passes through before it can be seeded or activated.
 */

export type ScriptImpactValidation = {
  valid: boolean;
  reason?: string;
};

/** SYSTEM_ONLY is reserved for a small, explicit allowlist of operational keys — never a stand-in for "no real impact." */
const SYSTEM_ONLY_ALLOWED_KEYS = new Set(["business.client_name", "system.client_id", "system.workspace_owner", "system.created_date"]);

export function validateQuestionScriptImpact(params: { key: string; scriptImpacts: ScriptImpact[] }): ScriptImpactValidation {
  if (params.scriptImpacts.length === 0) {
    return { valid: false, reason: "A question must declare at least one Script Impact." };
  }

  const isSystemOnly = params.scriptImpacts.every((impact) => impact === "SYSTEM_ONLY");
  if (isSystemOnly && !SYSTEM_ONLY_ALLOWED_KEYS.has(params.key)) {
    return {
      valid: false,
      reason: `"${params.key}" is marked SYSTEM_ONLY but is not on the operational allowlist — it needs a real Script Impact or must be removed.`,
    };
  }

  return { valid: true };
}

/** A field with no Script Impact must never be asked, imported, or promoted into Script Intelligence — only preserved as raw source material. */
export function hasScriptImpact(scriptImpacts: ScriptImpact[]): boolean {
  return scriptImpacts.length > 0;
}

import type { EvidenceStrength } from "@prisma/client";

/**
 * How the UI must visibly distinguish a belief's evidence state: missing (no
 * links), contradictory (any DISPUTED link — takes priority even alongside
 * strong evidence), weak (only ANECDOTAL/WEAK), or exists (at least one
 * MODERATE-or-stronger, non-disputed link). Pure and dependency-free so it
 * can be imported from both server services and client components.
 */
export type EvidenceState = "missing" | "contradictory" | "weak" | "exists";

export function evidenceState(links: { evidenceStrength: EvidenceStrength }[]): EvidenceState {
  if (links.length === 0) return "missing";
  if (links.some((l) => l.evidenceStrength === "DISPUTED")) return "contradictory";
  if (links.some((l) => l.evidenceStrength === "MODERATE" || l.evidenceStrength === "STRONG" || l.evidenceStrength === "VERIFIED")) {
    return "exists";
  }
  return "weak";
}

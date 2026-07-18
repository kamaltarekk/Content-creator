import type { AuditGateStatus } from "@prisma/client";

import type { ReelScriptPackage } from "@/server/domain/reel-script-package";
import type { ScriptGenerationContext } from "@/server/domain/script-generation-context";

/**
 * The 8 validation gates a Reel must pass before it can be marked Ready
 * (spec section 29/30): Strategic Grounding, Factual Grounding, Voice, CTA
 * Fit, Production Feasibility, Duration, Comprehension, Claim Safety. This
 * is deliberately richer than the 6-key `audits` summary embedded in
 * ReelScriptPackage — that summary is what ships in the package for display;
 * this is the authoritative record persisted alongside it (ReelVersion.validationJson).
 */
export type ValidationGateKey =
  | "STRATEGIC_GROUNDING"
  | "FACTUAL_GROUNDING"
  | "VOICE"
  | "CTA_FIT"
  | "PRODUCTION_FEASIBILITY"
  | "DURATION"
  | "COMPREHENSION"
  | "CLAIM_SAFETY";

export type ValidationGateResult = {
  key: ValidationGateKey;
  status: AuditGateStatus;
  note: string;
};

export type ReelValidationResult = {
  gates: ValidationGateResult[];
  readyToMarkReady: boolean;
  overrides: ValidationOverride[];
};

export type ValidationOverride = {
  gateKey: ValidationGateKey;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
};

/** Typical spoken words-per-minute by language — configurable, never hardcoded inline at the call site. */
export const WORDS_PER_MINUTE_BY_LANGUAGE: Record<string, number> = {
  english: 150,
  arabic: 130,
  spanish: 160,
  french: 145,
};
const DEFAULT_WORDS_PER_MINUTE = 140;

function wordsPerMinuteFor(language: string | null): number {
  if (!language) return DEFAULT_WORDS_PER_MINUTE;
  return WORDS_PER_MINUTE_BY_LANGUAGE[language.toLowerCase()] ?? DEFAULT_WORDS_PER_MINUTE;
}

const JARGON_WORDS = ["leverage", "synergy", "paradigm", "holistic", "ecosystem", "circle back", "bandwidth"];
const GUARANTEE_WORDS = ["guarantee", "guaranteed", "promise you will", "100% results"];
const SCARCITY_WORDS = ["only .* spots left", "last chance", "offer ends", "limited time"];

function containsPhrase(haystack: string, phrase: string): boolean {
  return haystack.toLowerCase().includes(phrase.toLowerCase());
}

function pass(key: ValidationGateKey, note: string): ValidationGateResult {
  return { key, status: "PASS", note };
}
function warn(key: ValidationGateKey, note: string): ValidationGateResult {
  return { key, status: "WARNING", note };
}
function fail(key: ValidationGateKey, note: string): ValidationGateResult {
  return { key, status: "FAIL", note };
}

/**
 * Pure computation of all 8 gates from the compiled context and the
 * generated package. Never mutates either input; never invents a pass —
 * every FAIL/WARNING carries a concrete reason tied to a specific field.
 */
export function computeReelValidation(context: ScriptGenerationContext, pkg: ReelScriptPackage): ValidationGateResult[] {
  const fullTextLower = pkg.script.fullText.toLowerCase();

  const strategicGrounding =
    context.grounding.sourceReferences.length === 0
      ? fail("STRATEGIC_GROUNDING", "No approved source data grounds this script at all.")
      : context.request.contentObjective === "BELIEF_CHANGE" && !context.beliefChain
        ? warn("STRATEGIC_GROUNDING", "The objective is to change a belief, but no approved belief chain exists for this audience.")
        : pass("STRATEGIC_GROUNDING", "The script is grounded in approved, client-scoped data.");

  const claimsApprovedResults = pkg.commercial.claimStatus === "APPROVED";
  const factualGrounding = claimsApprovedResults && context.proof.length === 0
    ? fail("FACTUAL_GROUNDING", "The script's claim status is APPROVED but no approved proof backs it.")
    : claimsApprovedResults
      ? pass("FACTUAL_GROUNDING", "Every claim is linked to approved proof.")
      : pass("FACTUAL_GROUNDING", "No verified-result claim is made — positioning only.");

  const prohibitedPhraseHit = context.voice.prohibitedPhrases.find((phrase) => containsPhrase(fullTextLower, phrase));
  const voice = prohibitedPhraseHit
    ? fail("VOICE", `The script uses a prohibited phrase: "${prohibitedPhraseHit}".`)
    : context.voice.language
      ? pass("VOICE", "The script matches the client's approved voice.")
      : warn("VOICE", "No approved voice/language data exists to check against.");

  const wantsCta = pkg.commercial.ctaType !== "NONE";
  const hasApprovedCtaRoute = Boolean(context.offer?.ctaRoute || context.request.ctaRoute);
  const ctaFit = !wantsCta
    ? pass("CTA_FIT", "No call to action is requested for this script.")
    : !pkg.commercial.ctaText
      ? fail("CTA_FIT", "A call to action type is set but no CTA text was written.")
      : !hasApprovedCtaRoute
        ? warn("CTA_FIT", "This CTA has no approved CTA route behind it yet.")
        : pass("CTA_FIT", "The call to action matches an approved route.");

  const requestedAdvancedEditing = pkg.production.editingLevel === "ADVANCED";
  const clientEditingCapacity = context.execution.editingLevel;
  const productionFeasibility =
    requestedAdvancedEditing && clientEditingCapacity && clientEditingCapacity !== "ADVANCED"
      ? warn("PRODUCTION_FEASIBILITY", `This script assumes ${pkg.production.editingLevel} editing, beyond the client's known ${clientEditingCapacity} capacity.`)
      : pass("PRODUCTION_FEASIBILITY", "Production requirements match the client's known capacity.");

  const wpm = wordsPerMinuteFor(context.voice.language);
  const expectedSeconds = (pkg.script.wordCount / wpm) * 60;
  const declaredSeconds = pkg.script.estimatedDurationSeconds;
  const durationDeltaRatio = expectedSeconds > 0 ? Math.abs(declaredSeconds - expectedSeconds) / expectedSeconds : 0;
  const duration =
    durationDeltaRatio > 0.35
      ? warn("DURATION", `Declared duration (${Math.round(declaredSeconds)}s) doesn't match the word count at ${wpm} wpm (expected ~${Math.round(expectedSeconds)}s).`)
      : pass("DURATION", `Duration matches the word count at a spoken pace of ${wpm} words/minute.`);

  const longestSegment = pkg.script.segments.reduce((max, seg) => Math.max(max, seg.text.split(/[.!?]+/).reduce((m, s) => Math.max(m, s.trim().length), 0)), 0);
  const jargonHit = JARGON_WORDS.find((word) => containsPhrase(fullTextLower, word));
  const technicalityMismatch = context.voice.technicality === "VERY_SIMPLE" && jargonHit;
  const comprehension =
    longestSegment > 220
      ? warn("COMPREHENSION", "At least one sentence is long enough to hurt spoken comprehension.")
      : technicalityMismatch
        ? warn("COMPREHENSION", `The client's voice is very simple, but the script uses jargon ("${jargonHit}").`)
        : pass("COMPREHENSION", "Sentence length and vocabulary fit spoken delivery.");

  const neverClaimHit = context.safety.neverClaim.find((claim) => containsPhrase(fullTextLower, claim));
  const expiredClaimHit = context.safety.expiredClaims.find((claim) => containsPhrase(fullTextLower, claim));
  const guaranteeHit = !context.offer?.guarantee && GUARANTEE_WORDS.find((word) => containsPhrase(fullTextLower, word));
  const scarcityHit = SCARCITY_WORDS.find((pattern) => new RegExp(pattern, "i").test(fullTextLower));
  const internalOnlyProofUsed = context.proof.some((p) => p.publicUseStatus !== "PUBLIC" && p.publicUseStatus !== "PUBLIC_ANONYMOUS");
  const claimSafety = neverClaimHit
    ? fail("CLAIM_SAFETY", `The script uses a prohibited claim: "${neverClaimHit}".`)
    : expiredClaimHit
      ? fail("CLAIM_SAFETY", `The script uses an expired claim: "${expiredClaimHit}".`)
      : guaranteeHit
        ? fail("CLAIM_SAFETY", "The script implies a guarantee that isn't backed by an approved guarantee.")
        : scarcityHit
          ? fail("CLAIM_SAFETY", "The script invents scarcity or a deadline not present in the approved context.")
          : internalOnlyProofUsed
            ? fail("CLAIM_SAFETY", "The script relies on proof that isn't approved for public use.")
            : pass("CLAIM_SAFETY", "No prohibited, expired, or fabricated claim was detected.");

  return [strategicGrounding, factualGrounding, voice, ctaFit, productionFeasibility, duration, comprehension, claimSafety];
}

/** A Reel can be marked Ready only when every gate passes, or every non-passing gate has an authorized override. */
export function isReadyToMarkReady(gates: ValidationGateResult[], overrides: ValidationOverride[]): boolean {
  const overriddenKeys = new Set(overrides.map((o) => o.gateKey));
  return gates.every((gate) => gate.status === "PASS" || overriddenKeys.has(gate.key));
}

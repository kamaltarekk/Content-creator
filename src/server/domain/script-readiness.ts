/**
 * Pure minimum-readiness rules (spec section 17): what must be true before
 * ANY Reel can be created, and what is ADDITIONALLY required only when the
 * Reel is commercial/promotional. Never blocks educational content on missing
 * pricing or proof — that gate only applies to the commercial checklist.
 */

export type ReadinessFacts = {
  hasWhatTheySell: boolean;
  hasApprovedAudience: boolean;
  hasSituationOrProblem: boolean;
  hasCurrentBelief: boolean;
  hasBetterBelief: boolean;
  hasLanguage: boolean;
  hasVoice: boolean;
  hasContentObjective: boolean;
  hasApprovedOffer: boolean;
  hasApprovedCta: boolean;
  hasSafeApprovedClaim: boolean;
  hasRelevantProofOrNonPerformancePositioning: boolean;
  hasUnresolvedCriticalClaimConflict: boolean;
};

export type ReadinessGap = {
  key: keyof ReadinessFacts;
  scope: "ANY_REEL" | "COMMERCIAL_REEL";
  label: string;
  message: string;
};

export type ScriptReadinessResult = {
  readyForEducational: boolean;
  readyForCommercial: boolean;
  statements: string[];
  gaps: ReadinessGap[];
};

const ANY_REEL_CHECKS: { key: keyof ReadinessFacts; label: string; message: string }[] = [
  { key: "hasWhatTheySell", label: "What they sell", message: "We don't yet know what this client sells." },
  { key: "hasApprovedAudience", label: "Audience", message: "No approved audience has been defined yet." },
  { key: "hasSituationOrProblem", label: "Situation or problem", message: "We don't know what situation or problem this audience is in." },
  { key: "hasCurrentBelief", label: "Current belief", message: "We don't know what this audience currently believes." },
  { key: "hasBetterBelief", label: "Better belief", message: "We don't have the better belief this content should build." },
  { key: "hasLanguage", label: "Language", message: "The client's language hasn't been set." },
  { key: "hasVoice", label: "Voice", message: "The client's voice hasn't been captured yet." },
  { key: "hasContentObjective", label: "Content objective", message: "We don't know what this content is trying to accomplish." },
];

const COMMERCIAL_REEL_CHECKS: { key: keyof ReadinessFacts; label: string; message: string }[] = [
  { key: "hasApprovedOffer", label: "Offer", message: "Needs an approved offer before creating commercial Reels." },
  { key: "hasApprovedCta", label: "Call to action", message: "Needs an approved call to action before creating commercial Reels." },
  { key: "hasSafeApprovedClaim", label: "Safe promise", message: "Needs a safe, approved promise before creating commercial Reels." },
  {
    key: "hasRelevantProofOrNonPerformancePositioning",
    label: "Proof",
    message: "Needs proof before using performance claims — or a clear non-performance positioning.",
  },
  {
    key: "hasUnresolvedCriticalClaimConflict",
    label: "Claim conflict",
    message: "An unresolved claim conflict must be resolved before creating commercial Reels.",
  },
];

export function computeScriptReadiness(facts: ReadinessFacts): ScriptReadinessResult {
  const anyReelGaps: ReadinessGap[] = ANY_REEL_CHECKS.filter((check) => !facts[check.key]).map((check) => ({
    ...check,
    scope: "ANY_REEL" as const,
  }));

  const commercialGaps: ReadinessGap[] = COMMERCIAL_REEL_CHECKS.filter((check) =>
    check.key === "hasUnresolvedCriticalClaimConflict" ? facts[check.key] : !facts[check.key],
  ).map((check) => ({ ...check, scope: "COMMERCIAL_REEL" as const }));

  const readyForEducational = anyReelGaps.length === 0;
  const readyForCommercial = readyForEducational && commercialGaps.length === 0;

  const statements: string[] = [];
  if (readyForEducational) {
    statements.push("Ready to create educational Reels.");
  } else {
    statements.push(`Needs ${anyReelGaps[0].label.toLowerCase()} before creating any Reel.`);
  }
  if (readyForCommercial) {
    statements.push("Ready to create commercial Reels.");
  } else if (readyForEducational) {
    statements.push(commercialGaps[0].message);
  }

  return { readyForEducational, readyForCommercial, statements, gaps: [...anyReelGaps, ...commercialGaps] };
}

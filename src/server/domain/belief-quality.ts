import { diceCoefficient } from "@/server/domain/similarity";

/**
 * Deterministic belief-map quality validation. A "wrong belief" must be
 * reframed into a better belief that is materially different (not a trivial
 * antonym swap like "Marketing is difficult" -> "Marketing can be easy") and
 * must lead to an actionable, different commercial decision. Never
 * auto-rewrites — only flags issues for a human reviewer.
 */

export type BeliefQualityInput = {
  currentBeliefStatement: string;
  behaviorCaused: string | null;
  commercialConsequence: string | null;
  betterBeliefStatement: string | null;
  betterCommercialDecision: string | null;
  /** Whether at least one EvidenceLink is attached to this belief map. */
  hasEvidence: boolean;
};

export type BeliefQualityIssue = { field: string; message: string };
export type BeliefQualityLevel = "weak" | "moderate" | "strong";

export type BeliefQualityResult = {
  score: number; // 0..1
  level: BeliefQualityLevel;
  issues: BeliefQualityIssue[];
  isWeak: boolean;
  /** True if the "better belief" is too similar to the current belief, or a trivial antonym swap. */
  isTrivialReframe: boolean;
};

/** Common trivial-antonym pairs seen in shallow reframes — not exhaustive, just a deterministic guard. */
const ANTONYM_PAIRS: Array<[string, string]> = [
  ["difficult", "easy"],
  ["hard", "easy"],
  ["expensive", "cheap"],
  ["slow", "fast"],
  ["impossible", "possible"],
  ["bad", "good"],
  ["wrong", "right"],
  ["risky", "safe"],
  ["complicated", "simple"],
];

function isTrivialAntonymSwap(current: string, better: string): boolean {
  const a = current.toLowerCase();
  const b = better.toLowerCase();
  return ANTONYM_PAIRS.some(([x, y]) => (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x)));
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

const MIN_REFRAME_WORDS = 6;
const MIN_DECISION_WORDS = 4;
/** Above this Dice similarity, the "better belief" isn't meaningfully different from the current one. */
const MAX_SIMILARITY = 0.6;
/** Above this, the "better decision" is just restating the better belief rather than an actionable next step. */
const MAX_BELIEF_DECISION_SIMILARITY = 0.85;

export function validateBeliefQuality(input: BeliefQualityInput): BeliefQualityResult {
  const issues: BeliefQualityIssue[] = [];
  const criteria = 6;
  let passed = 0;
  let isTrivialReframe = false;

  if (input.currentBeliefStatement?.trim()) {
    passed += 1;
  } else {
    issues.push({ field: "currentBeliefStatement", message: "Missing the current (wrong) belief statement." });
  }

  if (input.behaviorCaused?.trim()) {
    passed += 1;
  } else {
    issues.push({ field: "behaviorCaused", message: "Missing the behavior this belief causes." });
  }

  if (input.commercialConsequence?.trim()) {
    passed += 1;
  } else {
    issues.push({ field: "commercialConsequence", message: "Missing the commercial consequence of that behavior." });
  }

  if (!input.hasEvidence) {
    issues.push({ field: "evidence", message: "No evidence linked yet — flagged as a gap, not a blocker." });
  } else {
    passed += 1;
  }

  if (!input.betterBeliefStatement?.trim()) {
    issues.push({ field: "betterBeliefStatement", message: "Missing the better belief." });
  } else {
    const tooSimilar = diceCoefficient(input.currentBeliefStatement, input.betterBeliefStatement) > MAX_SIMILARITY;
    const tooShort = wordCount(input.betterBeliefStatement) < MIN_REFRAME_WORDS;
    const antonymSwap = isTrivialAntonymSwap(input.currentBeliefStatement, input.betterBeliefStatement);

    if (tooSimilar || tooShort || antonymSwap) {
      isTrivialReframe = true;
      issues.push({
        field: "betterBeliefStatement",
        message:
          "This reframe is too shallow — a materially different, developed belief is required (not just a one-word antonym swap).",
      });
    } else {
      passed += 1;
    }
  }

  if (!input.betterCommercialDecision?.trim()) {
    issues.push({ field: "betterCommercialDecision", message: "Missing the better commercial decision this belief leads to." });
  } else {
    const tooShort = wordCount(input.betterCommercialDecision) < MIN_DECISION_WORDS;
    const justRestatesBelief = input.betterBeliefStatement
      ? diceCoefficient(input.betterBeliefStatement, input.betterCommercialDecision) > MAX_BELIEF_DECISION_SIMILARITY
      : false;

    if (tooShort || justRestatesBelief) {
      issues.push({
        field: "betterCommercialDecision",
        message: "The better decision must be a concrete, actionable next step — not a restatement of the belief.",
      });
    } else {
      passed += 1;
    }
  }

  const score = passed / criteria;
  const level: BeliefQualityLevel = score >= 0.85 && !isTrivialReframe ? "strong" : score >= 0.5 ? "moderate" : "weak";

  return { score, level, issues, isWeak: level === "weak" || isTrivialReframe, isTrivialReframe };
}

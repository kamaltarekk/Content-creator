/**
 * Deterministic cohort quality validation. A cohort is not a fictional
 * persona — it must be grounded in a real commercial situation, not just a
 * demographic label ("Women 25–45", "Business owners"). This never rewrites
 * a cohort automatically; it only surfaces issues for a human to act on.
 */

export type CohortQualityInput = {
  name: string;
  definition: string | null;
  role: string | null;
  commercialContext: string | null;
  currentWorkflow: string | null;
  currentBelief: string | null;
  desiredOutcome: string | null;
  decisionRisk: string | null;
  /** Whether at least one CommercialSituation is linked to this cohort. */
  hasCommercialSituation: boolean;
  /** Whether the linked situation(s) carry a trigger type / description. */
  hasTrigger: boolean;
  /** Whether at least one BuyingDecision is linked to this cohort. */
  hasBuyingDecision: boolean;
};

export type CohortQualityIssue = { field: string; message: string };

export type CohortQualityLevel = "weak" | "moderate" | "strong";

export type CohortQualityResult = {
  score: number; // 0..1
  level: CohortQualityLevel;
  issues: CohortQualityIssue[];
  isWeak: boolean;
  /** True if the name/definition reads like a demographic label with no situational grounding. */
  isGenericLabel: boolean;
};

/** Words that suggest a name is describing a situation, not just a demographic bucket. */
const SITUATIONAL_MARKERS = [
  "who",
  "because",
  "blamed",
  "struggling",
  "facing",
  "under pressure",
  "trying to",
  "responsible for",
  "stuck",
  "losing",
  "failing",
  "behind on",
];

function looksGeneric(name: string, definition: string | null): boolean {
  const haystack = `${name} ${definition ?? ""}`.toLowerCase();
  const hasMarker = SITUATIONAL_MARKERS.some((marker) => haystack.includes(marker));
  const isShortLabel = name.trim().split(/\s+/).length <= 3;
  return isShortLabel && !hasMarker && !definition;
}

const CRITERIA: Array<{
  field: string;
  check: (c: CohortQualityInput) => boolean;
  message: string;
}> = [
  { field: "definition", check: (c) => Boolean(c.definition?.trim()), message: "No grounded definition — reads as a label, not a commercial reality." },
  { field: "commercialContext", check: (c) => Boolean(c.commercialContext?.trim()), message: "Missing commercial context — why does this cohort matter right now?" },
  { field: "currentWorkflow", check: (c) => Boolean(c.currentWorkflow?.trim()), message: "Missing current workflow — what does this cohort actually do today?" },
  { field: "currentBelief", check: (c) => Boolean(c.currentBelief?.trim()), message: "Missing current belief — what does this cohort think is true (even if wrong)?" },
  { field: "desiredOutcome", check: (c) => Boolean(c.desiredOutcome?.trim()), message: "Missing desired outcome — what does this cohort actually want to achieve?" },
  { field: "decisionRisk", check: (c) => Boolean(c.decisionRisk?.trim()), message: "Missing decision risk — what could stop this cohort from acting?" },
  { field: "commercialSituation", check: (c) => c.hasCommercialSituation, message: "No commercial situation linked — this cohort has no real-world trigger context yet." },
  { field: "trigger", check: (c) => c.hasTrigger, message: "Linked situation has no trigger — what specifically set this problem off?" },
  { field: "buyingDecision", check: (c) => c.hasBuyingDecision, message: "No buying decision linked — what decision does this cohort need help making?" },
];

export function validateCohortQuality(input: CohortQualityInput): CohortQualityResult {
  const issues: CohortQualityIssue[] = [];
  let passed = 0;

  for (const criterion of CRITERIA) {
    if (criterion.check(input)) {
      passed += 1;
    } else {
      issues.push({ field: criterion.field, message: criterion.message });
    }
  }

  const isGenericLabel = looksGeneric(input.name, input.definition);
  if (isGenericLabel) {
    issues.unshift({
      field: "name",
      message: `"${input.name}" reads like a demographic label, not a cohort grounded in a real commercial situation.`,
    });
  }

  const score = passed / CRITERIA.length;
  const level: CohortQualityLevel = score >= 0.75 && !isGenericLabel ? "strong" : score >= 0.4 ? "moderate" : "weak";

  return {
    score,
    level,
    issues,
    isWeak: level === "weak" || isGenericLabel,
    isGenericLabel,
  };
}

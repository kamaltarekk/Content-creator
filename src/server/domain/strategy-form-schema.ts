import { z } from "zod";

/** Zod schemas for the Module 2 strategy forms. Mirrors client-schema.ts's conventions. */

const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(""));

export const cohortFieldsSchema = z.object({
  name: z.string().min(2, "Cohort name must be at least 2 characters.").max(200),
  definition: optionalText(2000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  role: optionalText(200),
  commercialContext: optionalText(2000),
  currentWorkflow: optionalText(2000),
  currentBelief: optionalText(2000),
  desiredOutcome: optionalText(2000),
  decisionRisk: optionalText(2000),
  emotionalDrivers: z.array(z.string().max(100)).max(20).optional(),
  platformPresence: z.array(z.string().max(100)).max(20).optional(),
  attentionNotes: optionalText(2000),
});
export type CohortFieldsInput = z.infer<typeof cohortFieldsSchema>;

export const commercialSituationFieldsSchema = z.object({
  title: z.string().min(2).max(200),
  triggerType: z.enum([
    "EVENT",
    "PERFORMANCE_CHANGE",
    "LIFE_STAGE",
    "BUSINESS_STAGE",
    "INTERNAL_PRESSURE",
    "EXTERNAL_PRESSURE",
    "DEADLINE",
    "OPPORTUNITY",
    "FAILURE",
    "RISK",
    "REGULATORY_CHANGE",
    "MARKET_CHANGE",
    "OTHER",
  ]),
  triggerDescription: optionalText(2000),
  activeProblem: optionalText(2000),
  currentWorkflow: optionalText(2000),
  urgencyNote: optionalText(500),
});
export type CommercialSituationFieldsInput = z.infer<typeof commercialSituationFieldsSchema>;

export const buyingDecisionFieldsSchema = z.object({
  title: z.string().min(2).max(200),
  decisionType: z.enum([
    "PROBLEM_RECOGNITION",
    "CATEGORY_SELECTION",
    "BRAND_SELECTION",
    "OFFER_SELECTION",
    "BUDGET_APPROVAL",
    "INTERNAL_ALIGNMENT",
    "VENDOR_REPLACEMENT",
    "RENEWAL",
    "EXPANSION",
    "IMPLEMENTATION",
    "OTHER",
  ]),
  description: optionalText(2000),
  timeframe: optionalText(200),
  commercialSituationId: optionalText(100),
});
export type BuyingDecisionFieldsInput = z.infer<typeof buyingDecisionFieldsSchema>;

const buyingRoleEnum = z.enum([
  "USER",
  "INITIATOR",
  "INFLUENCER",
  "CHAMPION",
  "EVALUATOR",
  "APPROVER",
  "DECISION_MAKER",
  "PAYER",
  "BLOCKER",
  "PROCUREMENT",
  "LEGAL",
  "TECHNICAL_REVIEWER",
  "OTHER",
]);

export const buyingRoleParticipantFieldsSchema = z.object({
  role: buyingRoleEnum,
  label: z.string().min(1).max(150),
  influenceScore: z.number().min(1).max(5).optional().nullable(),
  stance: optionalText(200),
  notes: optionalText(1000),
});
export type BuyingRoleParticipantFieldsInput = z.infer<typeof buyingRoleParticipantFieldsSchema>;

export const objectionFieldsSchema = z.object({
  title: z.string().min(2).max(200),
  description: optionalText(2000),
  raisedByRole: buyingRoleEnum.optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  resolutionNote: optionalText(1000),
});
export type ObjectionFieldsInput = z.infer<typeof objectionFieldsSchema>;

export const decisionCriterionFieldsSchema = z.object({
  label: z.string().min(1).max(200),
  weightNote: optionalText(500),
  importance: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});
export type DecisionCriterionFieldsInput = z.infer<typeof decisionCriterionFieldsSchema>;

export const beliefMapFieldsSchema = z.object({
  observedSituation: optionalText(2000),
  currentInterpretation: optionalText(2000),
  currentBeliefStatement: z.string().min(2, "The current belief is required.").max(2000),
  beliefType: z
    .enum([
      "WRONG",
      "INCOMPLETE",
      "MISAPPLIED",
      "OUTDATED",
      "UNSUPPORTED",
      "CONTEXT_DEPENDENT",
      "LIMITING",
      "CATEGORY_ASSUMPTION",
      "PROCESS_ASSUMPTION",
      "METRIC_ASSUMPTION",
      "RISK_ASSUMPTION",
      "OTHER",
    ])
    .optional(),
  behaviorCaused: optionalText(2000),
  commercialConsequence: optionalText(2000),
  betterBeliefStatement: optionalText(2000),
  betterCommercialDecision: optionalText(2000),
  relevantOfferPlaceholder: optionalText(500),
  commercialSituationId: optionalText(100),
});
export type BeliefMapFieldsInput = z.infer<typeof beliefMapFieldsSchema>;

export const evidenceLinkFieldsSchema = z.object({
  description: z.string().min(2).max(2000),
  evidenceStrength: z.enum(["ANECDOTAL", "WEAK", "MODERATE", "STRONG", "VERIFIED", "DISPUTED"]).optional(),
  clientBrainItemId: optionalText(100),
  note: optionalText(1000),
});
export type EvidenceLinkFieldsInput = z.infer<typeof evidenceLinkFieldsSchema>;

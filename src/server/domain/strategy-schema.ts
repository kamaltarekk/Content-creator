import type {
  BeliefType,
  BuyingRole,
  DecisionType,
  StrategicEntityType,
  StrategicRelationshipType,
  TriggerType,
} from "@prisma/client";

/**
 * The single source of truth for Module 2's structure: enum labels, the
 * Strategy Setup Readiness weights, and the follow-up questions the
 * missing-evidence report surfaces. Mirrors the role brain-schema.ts plays
 * for Module 1 — reused by services, the readiness calculation, and the UI.
 */

export const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  EVENT: "Event",
  PERFORMANCE_CHANGE: "Performance change",
  LIFE_STAGE: "Life stage",
  BUSINESS_STAGE: "Business stage",
  INTERNAL_PRESSURE: "Internal pressure",
  EXTERNAL_PRESSURE: "External pressure",
  DEADLINE: "Deadline",
  OPPORTUNITY: "Opportunity",
  FAILURE: "Failure",
  RISK: "Risk",
  REGULATORY_CHANGE: "Regulatory change",
  MARKET_CHANGE: "Market change",
  OTHER: "Other",
};

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  PROBLEM_RECOGNITION: "Problem recognition",
  CATEGORY_SELECTION: "Category selection",
  BRAND_SELECTION: "Brand selection",
  OFFER_SELECTION: "Offer selection",
  BUDGET_APPROVAL: "Budget approval",
  INTERNAL_ALIGNMENT: "Internal alignment",
  VENDOR_REPLACEMENT: "Vendor replacement",
  RENEWAL: "Renewal",
  EXPANSION: "Expansion",
  IMPLEMENTATION: "Implementation",
  OTHER: "Other",
};

export const BUYING_ROLE_LABELS: Record<BuyingRole, string> = {
  USER: "User",
  INITIATOR: "Initiator",
  INFLUENCER: "Influencer",
  CHAMPION: "Champion",
  EVALUATOR: "Evaluator",
  APPROVER: "Approver",
  DECISION_MAKER: "Decision maker",
  PAYER: "Payer",
  BLOCKER: "Blocker",
  PROCUREMENT: "Procurement",
  LEGAL: "Legal",
  TECHNICAL_REVIEWER: "Technical reviewer",
  OTHER: "Other",
};

export const BELIEF_TYPE_LABELS: Record<BeliefType, string> = {
  WRONG: "Wrong",
  INCOMPLETE: "Incomplete",
  MISAPPLIED: "Misapplied",
  OUTDATED: "Outdated",
  UNSUPPORTED: "Unsupported",
  CONTEXT_DEPENDENT: "Context-dependent",
  LIMITING: "Limiting",
  CATEGORY_ASSUMPTION: "Category assumption",
  PROCESS_ASSUMPTION: "Process assumption",
  METRIC_ASSUMPTION: "Metric assumption",
  RISK_ASSUMPTION: "Risk assumption",
  OTHER: "Other",
};

export const STRATEGIC_ENTITY_TYPE_LABELS: Record<StrategicEntityType, string> = {
  CLIENT_BRAIN_ITEM: "Client Brain item",
  COHORT: "Cohort",
  COMMERCIAL_SITUATION: "Commercial situation",
  BUYING_DECISION: "Buying decision",
  BUYING_ROLE: "Buying role",
  BELIEF: "Belief",
  OBJECTION: "Objection",
  EVIDENCE: "Evidence",
  OFFER: "Offer",
  PROOF: "Proof",
  CONSTRAINT: "Constraint",
};

export const STRATEGIC_RELATIONSHIP_TYPE_LABELS: Record<StrategicRelationshipType, string> = {
  EXPERIENCES: "experiences",
  TRIGGERED_BY: "triggered by",
  BELIEVES: "believes",
  CAUSED_BY: "caused by",
  CAUSES: "causes",
  BLOCKED_BY: "blocked by",
  REQUIRES: "requires",
  EVALUATES_BY: "evaluates by",
  PARTICIPATES_IN: "participates in",
  SUPPORTS: "supports",
  CONTRADICTS: "contradicts",
  REFRAMES: "reframes",
  CHANGES_DECISION: "changes decision",
  SERVED_BY: "served by",
  RELEVANT_TO: "relevant to",
  VALIDATES: "validates",
  INVALIDATES: "invalidates",
};

/**
 * Strategy Setup Readiness weights (spec section 24). Sums to 100. Always
 * labeled "Strategy Setup Readiness" in the UI — never presented as a
 * prediction of business success.
 */
export const READINESS_WEIGHTS = {
  cohortDefinition: 20,
  commercialSituations: 15,
  triggers: 10,
  buyingDecisions: 15,
  buyingCommittee: 10,
  beliefs: 15,
  evidenceCoverage: 10,
  betterDecisions: 5,
} as const;

export type ReadinessCategory = keyof typeof READINESS_WEIGHTS;

export const READINESS_CATEGORY_LABELS: Record<ReadinessCategory, string> = {
  cohortDefinition: "Cohort definition",
  commercialSituations: "Commercial situations",
  triggers: "Triggers",
  buyingDecisions: "Buying decisions",
  buyingCommittee: "Buying committee",
  beliefs: "Beliefs",
  evidenceCoverage: "Evidence coverage",
  betterDecisions: "Better decisions",
};

/** Specific (not generic) follow-up questions the readiness report can surface per category. */
export const STRATEGY_FOLLOWUP_QUESTIONS: Record<ReadinessCategory, string> = {
  cohortDefinition:
    "Which cohort still reads like a demographic label rather than a commercial situation — who exactly is stuck, and why?",
  commercialSituations: "What specific event or pressure is pushing each cohort to act right now?",
  triggers: "For each cohort, what triggered the active problem — and when did it start?",
  buyingDecisions: "What is the exact decision this cohort needs to make, and what type of decision is it?",
  buyingCommittee: "Who else is involved in this decision besides the primary cohort — who can block it?",
  beliefs: "What does this cohort currently (wrongly) believe, and what better belief would change their decision?",
  evidenceCoverage: "What evidence actually supports the better belief — or is it still just a hypothesis?",
  betterDecisions: "If the better belief were adopted, what different commercial decision would follow?",
};

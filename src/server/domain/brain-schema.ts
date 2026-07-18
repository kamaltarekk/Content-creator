import type { ClientBrainFieldKey, ClientBrainSectionKey } from "@prisma/client";

/**
 * The single source of truth for the Client Brain's structure: which fields
 * belong to which section, how each field's value should be compared for
 * conflicts, which fields are "critical" for completeness, and how sections
 * are weighted. Reused by classification (to constrain AI output), the Client
 * Brain UI, conflict detection, and the completeness / missing-data services.
 */

export const SECTION_FIELD_MAP: Record<ClientBrainSectionKey, ClientBrainFieldKey[]> = {
  BUSINESS: ["BUSINESS_MODEL", "PRODUCTS_SERVICES", "REVENUE_MODEL", "BUYER", "PAYER", "SALES_PROCESS"],
  POSITIONING: [
    "CATEGORY",
    "CORE_PROMISE",
    "DIFFERENTIATION",
    "POINT_OF_VIEW",
    "BELIEFS_CHALLENGED",
    "BELIEFS_REINFORCED",
    "EXPERTISE_BOUNDARIES",
    "NON_TARGET_WORK",
  ],
  MARKETS: ["MARKET_NAME", "GEOGRAPHY", "MARKET_PROBLEM", "DEMAND", "MARKET_PURCHASING_POWER", "GROWTH", "COMPETITION"],
  COHORTS: [
    "COHORT_NAME",
    "ROLE",
    "COMMERCIAL_SITUATION",
    "TRIGGER",
    "ACTIVE_PROBLEM",
    "CURRENT_BELIEF",
    "DESIRED_OUTCOME",
    "BUYING_ROLE",
    "COHORT_PURCHASING_POWER",
    "PLATFORM_PRESENCE",
  ],
  BELIEFS: ["WRONG_BELIEF", "BELIEF_EVIDENCE", "BETTER_BELIEF", "COMMERCIAL_CONSEQUENCE", "BETTER_DECISION", "RELEVANT_OFFER"],
  VOICE: ["LANGUAGE", "DIALECT", "TONE", "VOCABULARY", "SENTENCE_STYLE", "HUMOR", "PROHIBITED_PHRASES", "TERMINOLOGY"],
  OFFERS: [
    "OFFER_NAME",
    "TARGET_COHORT",
    "PROMISE",
    "OUTCOME",
    "DELIVERY",
    "PRICE",
    "OFFER_PROOF",
    "GUARANTEE",
    "FAST_WIN",
    "CTA_ROUTE",
  ],
  PROOF: ["CASE_STUDY", "TESTIMONIAL", "RESULT", "ARTIFACT", "CREDENTIAL", "DEMONSTRATION"],
  BRAND_ASSOCIATIONS: ["DESIRED_ASSOCIATION", "CURRENT_ASSOCIATION", "NEGATIVE_ASSOCIATION", "DISTINCTIVE_ASSET"],
  PRODUCTION: [
    "FORMATS",
    "TEAM",
    "LOCATIONS",
    "EQUIPMENT",
    "EDITING_CAPACITY",
    "POSTING_CAPACITY",
    "PRODUCTION_CONSTRAINTS",
  ],
  COMMERCIAL_OBJECTIVES: ["NORTH_STAR", "LEADING_INDICATOR", "LAGGING_INDICATOR", "GUARDRAIL_METRIC"],
  CONSTRAINTS: ["LEGAL", "COMPLIANCE", "OPERATIONAL", "BRAND", "ETHICAL"],
  PROHIBITED_CLAIMS: ["CLAIM", "REASON", "APPLICABLE_CONTEXT"],
  LEARNINGS: ["LEARNING", "LEARNING_CONTEXT", "EVIDENCE_LEVEL", "APPLICABLE_SCOPE", "LEARNING_CONFIDENCE"],
};

export const ALL_SECTION_KEYS = Object.keys(SECTION_FIELD_MAP) as ClientBrainSectionKey[];

/** Reverse lookup: which section owns a given field. */
export const FIELD_TO_SECTION: Record<ClientBrainFieldKey, ClientBrainSectionKey> = Object.fromEntries(
  ALL_SECTION_KEYS.flatMap((section) => SECTION_FIELD_MAP[section].map((field) => [field, section])),
) as Record<ClientBrainFieldKey, ClientBrainSectionKey>;

export function isFieldInSection(section: ClientBrainSectionKey, field: ClientBrainFieldKey): boolean {
  return SECTION_FIELD_MAP[section].includes(field);
}

export const SECTION_LABELS: Record<ClientBrainSectionKey, string> = {
  BUSINESS: "Business",
  POSITIONING: "Positioning",
  MARKETS: "Markets",
  COHORTS: "Cohorts",
  BELIEFS: "Beliefs",
  VOICE: "Voice",
  OFFERS: "Offers",
  PROOF: "Proof",
  BRAND_ASSOCIATIONS: "Brand Associations",
  PRODUCTION: "Production Capacity",
  COMMERCIAL_OBJECTIVES: "Commercial Objectives",
  CONSTRAINTS: "Constraints",
  PROHIBITED_CLAIMS: "Prohibited Claims",
  LEARNINGS: "Client-Specific Learnings",
};

export const FIELD_LABELS: Record<ClientBrainFieldKey, string> = {
  BUSINESS_MODEL: "Business model",
  PRODUCTS_SERVICES: "Products / services",
  REVENUE_MODEL: "Revenue model",
  BUYER: "Buyer",
  PAYER: "Payer",
  SALES_PROCESS: "Sales process",
  CATEGORY: "Category",
  CORE_PROMISE: "Core promise",
  DIFFERENTIATION: "Differentiation",
  POINT_OF_VIEW: "Point of view",
  BELIEFS_CHALLENGED: "Beliefs challenged",
  BELIEFS_REINFORCED: "Beliefs reinforced",
  EXPERTISE_BOUNDARIES: "Expertise boundaries",
  NON_TARGET_WORK: "Non-target work",
  MARKET_NAME: "Market name",
  GEOGRAPHY: "Geography",
  MARKET_PROBLEM: "Market problem",
  DEMAND: "Demand",
  MARKET_PURCHASING_POWER: "Purchasing power",
  GROWTH: "Growth",
  COMPETITION: "Competition",
  COHORT_NAME: "Cohort name",
  ROLE: "Role",
  COMMERCIAL_SITUATION: "Commercial situation",
  TRIGGER: "Trigger",
  ACTIVE_PROBLEM: "Active problem",
  CURRENT_BELIEF: "Current belief",
  DESIRED_OUTCOME: "Desired outcome",
  BUYING_ROLE: "Buying role",
  COHORT_PURCHASING_POWER: "Purchasing power",
  PLATFORM_PRESENCE: "Platform presence",
  WRONG_BELIEF: "Wrong belief",
  BELIEF_EVIDENCE: "Evidence",
  BETTER_BELIEF: "Better belief",
  COMMERCIAL_CONSEQUENCE: "Commercial consequence",
  BETTER_DECISION: "Better decision",
  RELEVANT_OFFER: "Relevant offer",
  LANGUAGE: "Language",
  DIALECT: "Dialect",
  TONE: "Tone",
  VOCABULARY: "Vocabulary",
  SENTENCE_STYLE: "Sentence style",
  HUMOR: "Humor",
  PROHIBITED_PHRASES: "Prohibited phrases",
  TERMINOLOGY: "Terminology",
  OFFER_NAME: "Offer name",
  TARGET_COHORT: "Target cohort",
  PROMISE: "Promise",
  OUTCOME: "Outcome",
  DELIVERY: "Delivery",
  PRICE: "Price",
  OFFER_PROOF: "Proof",
  GUARANTEE: "Guarantee",
  FAST_WIN: "Fast win",
  CTA_ROUTE: "CTA route",
  CASE_STUDY: "Case study",
  TESTIMONIAL: "Testimonial",
  RESULT: "Result",
  ARTIFACT: "Artifact",
  CREDENTIAL: "Credential",
  DEMONSTRATION: "Demonstration",
  DESIRED_ASSOCIATION: "Desired association",
  CURRENT_ASSOCIATION: "Current association",
  NEGATIVE_ASSOCIATION: "Negative association",
  DISTINCTIVE_ASSET: "Distinctive asset",
  FORMATS: "Formats",
  TEAM: "Team",
  LOCATIONS: "Locations",
  EQUIPMENT: "Equipment",
  EDITING_CAPACITY: "Editing capacity",
  POSTING_CAPACITY: "Posting capacity",
  PRODUCTION_CONSTRAINTS: "Constraints",
  NORTH_STAR: "North star",
  LEADING_INDICATOR: "Leading indicator",
  LAGGING_INDICATOR: "Lagging indicator",
  GUARDRAIL_METRIC: "Guardrail metric",
  LEGAL: "Legal",
  COMPLIANCE: "Compliance",
  OPERATIONAL: "Operational",
  BRAND: "Brand",
  ETHICAL: "Ethical",
  CLAIM: "Claim",
  REASON: "Reason",
  APPLICABLE_CONTEXT: "Applicable context",
  LEARNING: "Learning",
  LEARNING_CONTEXT: "Context",
  EVIDENCE_LEVEL: "Evidence level",
  APPLICABLE_SCOPE: "Applicable scope",
  LEARNING_CONFIDENCE: "Confidence",
};

/**
 * Sections whose fields describe repeatable entities (many cohorts, offers,
 * beliefs, markets, proof items). Their rows are grouped by `groupId` and
 * labelled by the section's "name" field below. Flat sections have exactly
 * one logical value per field.
 */
export const ENTITY_SECTIONS: ClientBrainSectionKey[] = ["MARKETS", "COHORTS", "BELIEFS", "OFFERS", "PROOF"];

/** The field whose value names an entity instance (used for grouping + fuzzy conflict matching). */
export const ENTITY_NAME_FIELD: Partial<Record<ClientBrainSectionKey, ClientBrainFieldKey>> = {
  MARKETS: "MARKET_NAME",
  COHORTS: "COHORT_NAME",
  BELIEFS: "WRONG_BELIEF",
  OFFERS: "OFFER_NAME",
  PROOF: "CASE_STUDY",
};

export function isEntitySection(section: ClientBrainSectionKey): boolean {
  return ENTITY_SECTIONS.includes(section);
}

/** How a field's value is compared when deciding whether a new value conflicts with an existing one. */
export type FieldValueType = "percentage" | "numeric" | "list" | "text";

export const FIELD_VALUE_TYPE: Partial<Record<ClientBrainFieldKey, FieldValueType>> = {
  GROWTH: "percentage",
  DEMAND: "percentage",
  MARKET_PURCHASING_POWER: "percentage",
  COHORT_PURCHASING_POWER: "percentage",
  PRICE: "numeric",
  FORMATS: "list",
  TEAM: "list",
  EQUIPMENT: "list",
  PROHIBITED_PHRASES: "list",
  VOCABULARY: "list",
  TERMINOLOGY: "list",
};

export function fieldValueType(field: ClientBrainFieldKey): FieldValueType {
  return FIELD_VALUE_TYPE[field] ?? "text";
}

/**
 * Completeness weights (spec section 16). These 10 sections sum to 100%; the
 * remaining 4 (Brand Associations, Constraints, Prohibited Claims, Learnings)
 * are tracked but unweighted — reported as informational, not part of the
 * headline percentage.
 */
export const SECTION_WEIGHTS: Partial<Record<ClientBrainSectionKey, number>> = {
  BUSINESS: 10,
  POSITIONING: 15,
  MARKETS: 10,
  COHORTS: 15,
  BELIEFS: 10,
  VOICE: 10,
  OFFERS: 10,
  PROOF: 10,
  PRODUCTION: 5,
  COMMERCIAL_OBJECTIVES: 5,
};

/**
 * The subset of each section's fields that must be present for the section to
 * count as "covered" in the completeness score and the missing-data report.
 */
export const CRITICAL_FIELDS: Record<ClientBrainSectionKey, ClientBrainFieldKey[]> = {
  BUSINESS: ["BUSINESS_MODEL", "PRODUCTS_SERVICES", "REVENUE_MODEL"],
  POSITIONING: ["CATEGORY", "CORE_PROMISE", "DIFFERENTIATION", "POINT_OF_VIEW"],
  MARKETS: ["MARKET_NAME", "MARKET_PROBLEM", "DEMAND"],
  COHORTS: ["COHORT_NAME", "ACTIVE_PROBLEM", "CURRENT_BELIEF", "DESIRED_OUTCOME"],
  BELIEFS: ["WRONG_BELIEF", "BETTER_BELIEF", "BETTER_DECISION"],
  VOICE: ["LANGUAGE", "TONE", "PROHIBITED_PHRASES"],
  OFFERS: ["OFFER_NAME", "PROMISE", "PRICE", "CTA_ROUTE"],
  PROOF: ["CASE_STUDY", "RESULT"],
  BRAND_ASSOCIATIONS: ["DESIRED_ASSOCIATION"],
  PRODUCTION: ["FORMATS", "POSTING_CAPACITY"],
  COMMERCIAL_OBJECTIVES: ["NORTH_STAR", "GUARDRAIL_METRIC"],
  CONSTRAINTS: ["LEGAL", "COMPLIANCE"],
  PROHIBITED_CLAIMS: ["CLAIM"],
  LEARNINGS: ["LEARNING"],
};

/** Follow-up questions surfaced by the missing-data report when a critical field is absent. */
export const FIELD_FOLLOWUP_QUESTIONS: Partial<Record<ClientBrainFieldKey, string>> = {
  BUSINESS_MODEL: "How does this client actually make money — what's the core business model?",
  REVENUE_MODEL: "What's the revenue model (one-off, retainer, subscription, commission)?",
  CORE_PROMISE: "What's the single core promise this brand makes to its market?",
  DIFFERENTIATION: "What makes this client genuinely different from the obvious alternatives?",
  MARKET_PROBLEM: "What's the specific commercial problem the market is trying to solve?",
  DEMAND: "How strong and consistent is demand for this offer right now?",
  ACTIVE_PROBLEM: "What active, painful problem is each target cohort dealing with today?",
  DESIRED_OUTCOME: "What outcome does each cohort actually want to buy?",
  BETTER_BELIEF: "What better belief should replace the wrong one, and why is it true?",
  BETTER_DECISION: "What better commercial decision does the reframed belief lead to?",
  PRICE: "What does each offer cost, and is pricing fixed or variable?",
  CTA_ROUTE: "What's the exact next step you want a qualified prospect to take?",
  CASE_STUDY: "What proof assets (case studies, results) can back the claims?",
  RESULT: "What concrete, verifiable results have you produced for clients?",
  POSTING_CAPACITY: "How much content can the team realistically produce and post per week?",
  NORTH_STAR: "What's the single north-star metric this commercial system optimizes for?",
  GUARDRAIL_METRIC: "What guardrail metrics must not be sacrificed while chasing growth?",
  LANGUAGE: "What language and dialect should all content use?",
  TONE: "What tone should the voice strike?",
  PROHIBITED_PHRASES: "Are there phrases, claims, or styles the client refuses to use?",
};

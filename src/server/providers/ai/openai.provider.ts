import "server-only";

import OpenAI from "openai";

import {
  AIProviderError,
  ClassificationSchema,
  type AIProvider,
  type ClassificationResult,
  type ClassifyBlockInput,
} from "@/server/providers/ai/ai.provider";
import { SECTION_FIELD_MAP } from "@/server/domain/brain-schema";
import {
  StrategySuggestionSchema,
  type StrategySuggestionResult,
  type SuggestStrategyInput,
} from "@/server/domain/strategy-suggestion";

const DEFAULT_MODEL = "gpt-4.1-mini";

function buildSystemPrompt(): string {
  const sectionFieldLines = Object.entries(SECTION_FIELD_MAP)
    .map(([section, fields]) => `- ${section}: ${fields.join(", ")}`)
    .join("\n");

  return [
    "You classify one block of text extracted from a client's source document for a commercial strategy system.",
    "Not everything in a source is strategic truth. A customer message is usually AUDIENCE_SIGNAL; a real result is EVIDENCE; a 'we think' statement is a HYPOTHESIS; an explicit client positioning statement is a STRATEGIC_FACT or CLIENT_PREFERENCE; a URL is EXTERNAL_SOURCE; incidental notes are RAW_NOTE.",
    "",
    "Return ONLY a JSON object with these exact keys:",
    '- information_type: one of STRATEGIC_FACT, CLIENT_PREFERENCE, AUDIENCE_SIGNAL, EVIDENCE, HYPOTHESIS, EXAMPLE, PERFORMANCE_LEARNING, RAW_NOTE, EXTERNAL_SOURCE, CONFLICT, MISSING_INFORMATION',
    "- proposed_destination: one of the section keys below, or null if it doesn't map to the Client Brain",
    "- proposed_field: one of the fields belonging to the chosen section, or null",
    "- normalized_value: a concise, cleaned statement of the information (<=2000 chars)",
    "- confidence: a number 0..1 reflecting how sure you are of the classification",
    "- detected_language: BCP-47-ish code or short name of the block's language",
    "- is_conflict_candidate: true if this value plausibly contradicts a typical existing brain value",
    "- reasoning_summary: ONE short, user-safe sentence (never internal chain-of-thought)",
    "- suggested_tags: up to 6 short tags",
    "",
    "For STRATEGIC_FACT, CLIENT_PREFERENCE, AUDIENCE_SIGNAL, EVIDENCE, HYPOTHESIS and PERFORMANCE_LEARNING you MUST provide a valid proposed_destination AND proposed_field. The field must belong to the section:",
    sectionFieldLines,
    "",
    "If nothing fits, use information_type RAW_NOTE with null destination and field. Never invent facts; classify only what the block says.",
  ].join("\n");
}

function buildUserPrompt(input: ClassifyBlockInput): string {
  return [
    `Client: ${input.clientContext.clientName} (brand type: ${input.clientContext.brandType})`,
    `Source category: ${input.sourceCategory}`,
    `Existing Client Brain summary (for conflict awareness): ${input.clientContext.existingBrainDigest || "(empty)"}`,
    `Block type: ${input.blockType}`,
    `Block location: ${input.locationLabel}`,
    "Block text:",
    '"""',
    input.blockText.slice(0, 4000),
    '"""',
  ].join("\n");
}

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AIProviderError(
        "OPENAI_API_KEY is not set. Classification requires an API key — it will not fabricate results.",
      );
    }
    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  }

  async classifyBlock(input: ClassifyBlockInput): Promise<ClassificationResult> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(input) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new AIProviderError("OpenAI returned an empty classification response.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AIProviderError("OpenAI classification response was not valid JSON.");
    }

    const result = ClassificationSchema.safeParse(parsed);
    if (!result.success) {
      throw new AIProviderError(`OpenAI classification failed schema validation: ${result.error.message}`);
    }

    return result.data;
  }

  async suggestStrategy(input: SuggestStrategyInput): Promise<StrategySuggestionResult> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildStrategySystemPrompt() },
        { role: "user", content: buildStrategyUserPrompt(input) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new AIProviderError("OpenAI returned an empty strategy suggestion response.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AIProviderError("OpenAI strategy suggestion response was not valid JSON.");
    }

    const result = StrategySuggestionSchema.safeParse(parsed);
    if (!result.success) {
      throw new AIProviderError(`OpenAI strategy suggestion failed schema validation: ${result.error.message}`);
    }

    return result.data;
  }
}

function buildStrategySystemPrompt(): string {
  return [
    "You propose ONE new strategy entity for a commercial reasoning system. This is not a persona generator —",
    "every suggestion must be grounded in the provided context (the Client Brain digest, existing strategy digest,",
    "and selected audience signals). Never invent facts, evidence, or names that aren't implied by the context.",
    "",
    "Return ONLY a JSON object with these exact keys:",
    "- suggestion_type: one of COHORT, COMMERCIAL_SITUATION, BUYING_DECISION, BUYING_ROLE_PARTICIPANT, BELIEF_MAP, EVIDENCE_LINK, RELATIONSHIP, OTHER",
    "- title: a short, specific title for the suggestion (not a generic label)",
    "- proposed_fields: an object with the fields for that suggestion_type. Field shapes:",
    "  COHORT: {name, definition, priority, role, commercialContext, currentWorkflow, currentBelief, desiredOutcome, decisionRisk, attentionNotes}",
    "  COMMERCIAL_SITUATION: {cohortId, title, triggerType, triggerDescription, activeProblem, currentWorkflow, urgencyNote}",
    "  BUYING_DECISION: {cohortId, title, decisionType, description, timeframe}",
    "  BUYING_ROLE_PARTICIPANT: {buyingDecisionId, role, label, influenceScore, stance, notes}",
    "  BELIEF_MAP: {cohortId, currentBeliefStatement, beliefType, observedSituation, currentInterpretation, behaviorCaused, commercialConsequence, betterBeliefStatement, betterCommercialDecision}",
    "  EVIDENCE_LINK: {targetEntityType, targetEntityId, description, evidenceStrength}",
    "  RELATIONSHIP: {fromEntityId, toEntityId, relationshipType}",
    "  Use ids from the existing strategy digest when referencing an existing cohort/decision/entity; omit a key if you don't have a grounded value rather than guessing.",
    "- source_references: array of {source_type, reference_id, note?} pointing at what in the context grounds this suggestion",
    "- confidence: 0..1",
    "- reasoning_summary: ONE short, user-safe sentence (never internal chain-of-thought)",
    "- missing_evidence: short list of what evidence would be needed to fully validate this",
    "- possible_conflicts: array of {existing_entity_type, existing_entity_id, reason} — only if the existing strategy digest shows something this might duplicate or contradict, else an empty array",
    "- suggested_relationships: array of {target_entity_type, target_entity_id, relationship_type} — only for entities that already exist in the digest, else an empty array",
  ].join("\n");
}

function buildStrategyUserPrompt(input: SuggestStrategyInput): string {
  return [
    `Client: ${input.context.clientName} (brand type: ${input.context.brandType})`,
    `Requested suggestion type: ${input.targetType}`,
    "Client Brain digest:",
    input.context.existingBrainDigest || "(empty)",
    "Existing strategy digest (cohorts, situations, decisions, beliefs already in the system):",
    input.context.existingStrategyDigest || "(empty)",
    "Selected audience signals:",
    input.context.selectedAudienceSignals.length > 0 ? input.context.selectedAudienceSignals.join("\n") : "(none selected)",
  ].join("\n");
}

let cachedProvider: AIProvider | null = null;

/** Lazily constructs the provider so a missing API key only errors when classification actually runs. */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    cachedProvider = new OpenAIProvider();
  }
  return cachedProvider;
}

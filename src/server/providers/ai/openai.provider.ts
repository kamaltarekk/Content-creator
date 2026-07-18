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
}

let cachedProvider: AIProvider | null = null;

/** Lazily constructs the provider so a missing API key only errors when classification actually runs. */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    cachedProvider = new OpenAIProvider();
  }
  return cachedProvider;
}

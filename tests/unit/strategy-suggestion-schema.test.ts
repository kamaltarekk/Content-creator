import { describe, expect, it } from "vitest";

import { StrategySuggestionSchema } from "@/server/domain/strategy-suggestion";

const base = {
  suggestion_type: "COHORT" as const,
  title: "Marketing managers blamed for weak conversion",
  proposed_fields: { name: "Marketing managers blamed for weak conversion", priority: "HIGH" },
  source_references: [{ source_type: "AUDIENCE_SIGNAL" as const, reference_id: "sig-1", note: "Customer complaint" }],
  confidence: 0.7,
  reasoning_summary: "Grounded in a recurring audience signal about blame for conversion.",
  missing_evidence: ["A quantified example of the blame pattern"],
  possible_conflicts: [],
  suggested_relationships: [],
};

describe("StrategySuggestionSchema", () => {
  it("accepts a well-formed suggestion", () => {
    expect(StrategySuggestionSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an empty proposed_fields object", () => {
    const result = StrategySuggestionSchema.safeParse({ ...base, proposed_fields: {} });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown suggestion_type", () => {
    expect(StrategySuggestionSchema.safeParse({ ...base, suggestion_type: "NONSENSE" }).success).toBe(false);
  });

  it("rejects confidence outside 0..1", () => {
    expect(StrategySuggestionSchema.safeParse({ ...base, confidence: 1.2 }).success).toBe(false);
    expect(StrategySuggestionSchema.safeParse({ ...base, confidence: -0.1 }).success).toBe(false);
  });

  it("accepts possible_conflicts referencing an existing entity", () => {
    const result = StrategySuggestionSchema.safeParse({
      ...base,
      possible_conflicts: [{ existing_entity_type: "COHORT", existing_entity_id: "c1", reason: "Similar name" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed source_reference missing reference_id", () => {
    const result = StrategySuggestionSchema.safeParse({
      ...base,
      source_references: [{ source_type: "MANUAL" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a reasoning_summary that is too long", () => {
    expect(StrategySuggestionSchema.safeParse({ ...base, reasoning_summary: "x".repeat(401) }).success).toBe(false);
  });

  it("never requires chain-of-thought — reasoning_summary is a short user-safe sentence", () => {
    const result = StrategySuggestionSchema.safeParse(base);
    expect(result.success && result.data.reasoning_summary.length).toBeLessThanOrEqual(400);
  });
});

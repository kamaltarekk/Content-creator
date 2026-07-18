import { describe, expect, it } from "vitest";

import { ClassificationSchema } from "@/server/providers/ai/ai.provider";

const base = {
  information_type: "STRATEGIC_FACT" as const,
  proposed_destination: "POSITIONING" as const,
  proposed_field: "CORE_PROMISE" as const,
  normalized_value: "Reframes wrong marketing beliefs into better commercial decisions.",
  confidence: 0.8,
  detected_language: "en",
  is_conflict_candidate: false,
  reasoning_summary: "An explicit positioning statement written by the client.",
  suggested_tags: ["positioning"],
};

describe("ClassificationSchema", () => {
  it("accepts a well-formed classification", () => {
    expect(ClassificationSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a field that does not belong to the proposed section", () => {
    const result = ClassificationSchema.safeParse({ ...base, proposed_field: "PRICE" });
    expect(result.success).toBe(false);
  });

  it("requires destination and field for strategic information types", () => {
    const result = ClassificationSchema.safeParse({
      ...base,
      information_type: "EVIDENCE",
      proposed_destination: null,
      proposed_field: null,
    });
    expect(result.success).toBe(false);
  });

  it("allows null destination for RAW_NOTE", () => {
    const result = ClassificationSchema.safeParse({
      ...base,
      information_type: "RAW_NOTE",
      proposed_destination: null,
      proposed_field: null,
    });
    expect(result.success).toBe(true);
  });

  it("allows null destination for EXTERNAL_SOURCE (a URL)", () => {
    const result = ClassificationSchema.safeParse({
      ...base,
      information_type: "EXTERNAL_SOURCE",
      proposed_destination: null,
      proposed_field: null,
      normalized_value: "https://example.com/case-study",
    });
    expect(result.success).toBe(true);
  });

  it("rejects confidence outside 0..1", () => {
    expect(ClassificationSchema.safeParse({ ...base, confidence: 1.4 }).success).toBe(false);
    expect(ClassificationSchema.safeParse({ ...base, confidence: -0.1 }).success).toBe(false);
  });

  it("rejects an unknown information_type", () => {
    expect(ClassificationSchema.safeParse({ ...base, information_type: "NONSENSE" }).success).toBe(false);
  });

  it("rejects a reasoning_summary that is too long", () => {
    expect(ClassificationSchema.safeParse({ ...base, reasoning_summary: "x".repeat(401) }).success).toBe(false);
  });
});

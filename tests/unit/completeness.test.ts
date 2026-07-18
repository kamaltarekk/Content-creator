import { describe, expect, it } from "vitest";

import { computeCompleteness, type CompletenessItem } from "@/server/services/completeness.service";
import { CRITICAL_FIELDS } from "@/server/domain/brain-schema";

function item(partial: Partial<CompletenessItem>): CompletenessItem {
  return {
    sectionKey: "BUSINESS",
    fieldKey: "BUSINESS_MODEL",
    groupId: "g1",
    status: "ACTIVE",
    confidence: 1,
    ...partial,
  };
}

describe("computeCompleteness", () => {
  it("is 0% for an empty brain", () => {
    const result = computeCompleteness([]);
    expect(result.overall).toBe(0);
    expect(result.sections).toHaveLength(14);
  });

  it("counts only ACTIVE items toward coverage", () => {
    const items = CRITICAL_FIELDS.BUSINESS.map((field) =>
      item({ sectionKey: "BUSINESS", fieldKey: field, status: "DRAFT" }),
    );
    const result = computeCompleteness(items);
    const business = result.sections.find((s) => s.sectionKey === "BUSINESS")!;
    expect(business.coverage).toBe(0);
  });

  it("reaches full coverage for a flat section when all critical fields are present", () => {
    const items = CRITICAL_FIELDS.BUSINESS.map((field) =>
      item({ sectionKey: "BUSINESS", fieldKey: field, confidence: 1 }),
    );
    const result = computeCompleteness(items);
    const business = result.sections.find((s) => s.sectionKey === "BUSINESS")!;
    expect(business.coverage).toBe(1);
    expect(business.score).toBe(1);
    expect(business.weightedContribution).toBe(10); // BUSINESS weight
    expect(business.missingCriticalFields).toHaveLength(0);
  });

  it("weights confidence into the section score", () => {
    const items = CRITICAL_FIELDS.BUSINESS.map((field) =>
      item({ sectionKey: "BUSINESS", fieldKey: field, confidence: 0.5 }),
    );
    const result = computeCompleteness(items);
    const business = result.sections.find((s) => s.sectionKey === "BUSINESS")!;
    expect(business.coverage).toBe(1);
    expect(business.avgConfidence).toBe(0.5);
    expect(business.score).toBe(0.5);
    expect(business.weightedContribution).toBe(5);
  });

  it("treats manual items (null confidence) as fully confident", () => {
    const items = CRITICAL_FIELDS.BUSINESS.map((field) =>
      item({ sectionKey: "BUSINESS", fieldKey: field, confidence: null }),
    );
    const result = computeCompleteness(items);
    const business = result.sections.find((s) => s.sectionKey === "BUSINESS")!;
    expect(business.avgConfidence).toBe(1);
  });

  it("lists missing critical fields", () => {
    const [first] = CRITICAL_FIELDS.BUSINESS;
    const result = computeCompleteness([item({ sectionKey: "BUSINESS", fieldKey: first })]);
    const business = result.sections.find((s) => s.sectionKey === "BUSINESS")!;
    expect(business.missingCriticalFields.length).toBe(CRITICAL_FIELDS.BUSINESS.length - 1);
  });

  it("uses the best-populated group for entity sections", () => {
    // Group A has 1 of the critical cohort fields; group B has all of them.
    const cohortCriticals = CRITICAL_FIELDS.COHORTS;
    const items: CompletenessItem[] = [
      item({ sectionKey: "COHORTS", fieldKey: cohortCriticals[0], groupId: "A" }),
      ...cohortCriticals.map((field) => item({ sectionKey: "COHORTS", fieldKey: field, groupId: "B" })),
    ];
    const result = computeCompleteness(items);
    const cohorts = result.sections.find((s) => s.sectionKey === "COHORTS")!;
    expect(cohorts.coverage).toBe(1);
  });

  it("never exceeds 100 overall", () => {
    // Fill every critical field of every section at full confidence.
    const items: CompletenessItem[] = [];
    for (const [section, fields] of Object.entries(CRITICAL_FIELDS)) {
      for (const field of fields) {
        items.push(
          item({
            sectionKey: section as CompletenessItem["sectionKey"],
            fieldKey: field,
            groupId: "g1",
            confidence: 1,
          }),
        );
      }
    }
    const result = computeCompleteness(items);
    expect(result.overall).toBe(100);
  });
});

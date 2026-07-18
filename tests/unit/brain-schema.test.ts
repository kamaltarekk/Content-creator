import { describe, expect, it } from "vitest";

import {
  ALL_SECTION_KEYS,
  CRITICAL_FIELDS,
  FIELD_TO_SECTION,
  SECTION_FIELD_MAP,
  SECTION_WEIGHTS,
  ENTITY_NAME_FIELD,
  ENTITY_SECTIONS,
  fieldValueType,
  isFieldInSection,
} from "@/server/domain/brain-schema";

describe("brain-schema destination model", () => {
  it("covers all 14 sections", () => {
    expect(ALL_SECTION_KEYS).toHaveLength(14);
  });

  it("maps every field back to exactly one section", () => {
    for (const section of ALL_SECTION_KEYS) {
      for (const field of SECTION_FIELD_MAP[section]) {
        expect(FIELD_TO_SECTION[field]).toBe(section);
      }
    }
  });

  it("validates field/section membership", () => {
    expect(isFieldInSection("POSITIONING", "CORE_PROMISE")).toBe(true);
    expect(isFieldInSection("POSITIONING", "PRICE")).toBe(false);
    expect(isFieldInSection("OFFERS", "PRICE")).toBe(true);
  });

  it("weights the 10 scored sections to exactly 100", () => {
    const total = Object.values(SECTION_WEIGHTS).reduce((sum, weight) => sum + (weight ?? 0), 0);
    expect(total).toBe(100);
  });

  it("keeps the 4 informational sections unweighted", () => {
    expect(SECTION_WEIGHTS.BRAND_ASSOCIATIONS).toBeUndefined();
    expect(SECTION_WEIGHTS.CONSTRAINTS).toBeUndefined();
    expect(SECTION_WEIGHTS.PROHIBITED_CLAIMS).toBeUndefined();
    expect(SECTION_WEIGHTS.LEARNINGS).toBeUndefined();
  });

  it("gives every entity section a name field belonging to that section", () => {
    for (const section of ENTITY_SECTIONS) {
      const nameField = ENTITY_NAME_FIELD[section];
      expect(nameField).toBeDefined();
      expect(isFieldInSection(section, nameField!)).toBe(true);
    }
  });

  it("only lists critical fields that exist in their section", () => {
    for (const section of ALL_SECTION_KEYS) {
      for (const field of CRITICAL_FIELDS[section]) {
        expect(isFieldInSection(section, field)).toBe(true);
      }
    }
  });

  it("classifies field value types for conflict comparison", () => {
    expect(fieldValueType("PRICE")).toBe("numeric");
    expect(fieldValueType("GROWTH")).toBe("percentage");
    expect(fieldValueType("FORMATS")).toBe("list");
    expect(fieldValueType("CORE_PROMISE")).toBe("text");
  });
});

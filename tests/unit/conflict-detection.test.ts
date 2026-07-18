import { describe, expect, it } from "vitest";

import { compareValues } from "@/server/services/conflict.service";
import { diceCoefficient } from "@/server/domain/similarity";

describe("compareValues — numeric price", () => {
  it("flags a materially different price as a conflict", () => {
    const result = compareValues("PRICE", "45,000 EGP", "30,000 EGP");
    expect(result.isConflict).toBe(true);
    expect(result.changeType).toBe("CONFLICTING");
  });

  it("treats a small price change within 10% as a non-conflicting update", () => {
    const result = compareValues("PRICE", "45,000 EGP", "46,000 EGP");
    expect(result.isConflict).toBe(false);
    expect(result.changeType).toBe("UPDATED");
  });
});

describe("compareValues — percentage", () => {
  it("tolerates drift within max(2pp, 15%)", () => {
    const result = compareValues("GROWTH", "20%", "22%");
    expect(result.isConflict).toBe(false);
  });

  it("flags drift beyond tolerance", () => {
    const result = compareValues("GROWTH", "20%", "40%");
    expect(result.isConflict).toBe(true);
  });
});

describe("compareValues — list fields", () => {
  it("treats pure additions as a safe merge", () => {
    const result = compareValues("FORMATS", "reels, carousels", "reels, carousels, shorts");
    expect(result.isConflict).toBe(false);
    expect(result.changeType).toBe("UPDATED");
  });

  it("flags large removals as a conflict", () => {
    const result = compareValues("FORMATS", "reels, carousels, shorts, lives", "reels");
    expect(result.isConflict).toBe(true);
  });
});

describe("compareValues — free text", () => {
  it("treats near-identical wording as unchanged", () => {
    const result = compareValues(
      "CORE_PROMISE",
      "Turn a wrong marketing belief into a better commercial decision.",
      "Turn a wrong marketing belief into a better commercial decision",
    );
    expect(result.changeType).toBe("UNCHANGED");
    expect(result.isConflict).toBe(false);
  });

  it("flags a substantially different statement as a strong conflict", () => {
    const result = compareValues(
      "CATEGORY",
      "Commercial Marketing Belief Reframer",
      "Performance marketing consultant",
    );
    expect(result.isConflict).toBe(true);
    expect(result.changeType).toBe("CONFLICTING");
  });

  it("identical values are unchanged with no conflict", () => {
    const result = compareValues("CATEGORY", "Same value", "Same value");
    expect(result.changeType).toBe("UNCHANGED");
    expect(result.isConflict).toBe(false);
  });
});

describe("diceCoefficient", () => {
  it("is 1 for identical strings and lower for different ones", () => {
    expect(diceCoefficient("hello world", "hello world")).toBe(1);
    expect(diceCoefficient("hello world", "goodbye moon")).toBeLessThan(0.3);
  });
});

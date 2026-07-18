import { describe, expect, it } from "vitest";

import { fingerprint, normalizeForComparison } from "@/server/services/validation.service";

describe("normalizeForComparison", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeForComparison("High ROAS  means, success!")).toBe("high roas means success");
  });

  it("treats case, trailing punctuation, and spacing differences as equal", () => {
    expect(normalizeForComparison("CEO Marketing Decision Session.")).toBe(
      normalizeForComparison("ceo   marketing decision session"),
    );
  });
});

describe("fingerprint (duplicate detection)", () => {
  it("produces identical fingerprints for values differing only in case/punctuation", () => {
    expect(fingerprint("CEO Marketing Decision Session.")).toBe(fingerprint("ceo marketing decision session"));
  });

  it("produces different fingerprints for materially different values", () => {
    expect(fingerprint("45,000 EGP")).not.toBe(fingerprint("30,000 EGP"));
  });
});

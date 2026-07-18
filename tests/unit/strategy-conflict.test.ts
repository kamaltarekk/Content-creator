import { describe, expect, it } from "vitest";

import { findMostSimilar, isBulkApprovable } from "@/server/domain/strategy-conflict";

describe("findMostSimilar", () => {
  const existing = [
    { id: "c1", value: "Marketing managers blamed for weak sales conversion" },
    { id: "c2", value: "First-time founders overwhelmed by fundraising" },
  ];

  it("finds a duplicate candidate above the similarity threshold", () => {
    const match = findMostSimilar("Marketing managers blamed for weak conversion rates", existing);
    expect(match?.id).toBe("c1");
  });

  it("returns null when nothing is similar enough", () => {
    const match = findMostSimilar("Retired teachers exploring consulting", existing);
    expect(match).toBeNull();
  });

  it("picks the single best match when multiple could match", () => {
    const match = findMostSimilar("Marketing managers blamed for weak sales conversion", existing);
    expect(match?.id).toBe("c1");
    expect(match?.similarity).toBeGreaterThan(0.9);
  });
});

describe("isBulkApprovable", () => {
  it("is approvable when high-confidence, non-duplicate, and conflict-free", () => {
    expect(isBulkApprovable({ confidence: 0.9, isDuplicateCandidate: false, possibleConflictsCount: 0, suggestionType: "COHORT" })).toBe(true);
  });

  it("is never bulk-approvable when it's a duplicate candidate", () => {
    expect(isBulkApprovable({ confidence: 0.95, isDuplicateCandidate: true, possibleConflictsCount: 0, suggestionType: "COHORT" })).toBe(false);
  });

  it("is never bulk-approvable when it has possible conflicts", () => {
    expect(isBulkApprovable({ confidence: 0.95, isDuplicateCandidate: false, possibleConflictsCount: 1, suggestionType: "BELIEF_MAP" })).toBe(false);
  });

  it("is not bulk-approvable below the confidence threshold", () => {
    expect(isBulkApprovable({ confidence: 0.5, isDuplicateCandidate: false, possibleConflictsCount: 0, suggestionType: "COHORT" })).toBe(false);
  });
});

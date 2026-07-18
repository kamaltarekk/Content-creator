import { describe, expect, it } from "vitest";

import { evidenceState } from "@/server/domain/evidence";

describe("evidenceState", () => {
  it("is missing with no links", () => {
    expect(evidenceState([])).toBe("missing");
  });

  it("is weak with only anecdotal/weak links", () => {
    expect(evidenceState([{ evidenceStrength: "ANECDOTAL" }, { evidenceStrength: "WEAK" }])).toBe("weak");
  });

  it("is exists with at least one moderate-or-stronger link", () => {
    expect(evidenceState([{ evidenceStrength: "WEAK" }, { evidenceStrength: "STRONG" }])).toBe("exists");
    expect(evidenceState([{ evidenceStrength: "VERIFIED" }])).toBe("exists");
    expect(evidenceState([{ evidenceStrength: "MODERATE" }])).toBe("exists");
  });

  it("is contradictory when any link is disputed, even alongside strong evidence", () => {
    expect(evidenceState([{ evidenceStrength: "VERIFIED" }, { evidenceStrength: "DISPUTED" }])).toBe("contradictory");
  });
});

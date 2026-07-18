import { describe, expect, it } from "vitest";

import { slugify } from "@/server/domain/slug";
import { SignUpSchema } from "@/server/domain/auth-schema";

describe("slugify", () => {
  it("lowercases and hyphenates arbitrary text", () => {
    expect(slugify("Acme Growth Partners")).toBe("acme-growth-partners");
  });

  it("strips non-alphanumeric characters and collapses repeats", () => {
    expect(slugify("  Kamal's -- Agency!!  ")).toBe("kamal-s-agency");
  });

  it("falls back to 'org' when the input has no alphanumeric characters", () => {
    expect(slugify("!!!")).toBe("org");
  });
});

describe("SignUpSchema", () => {
  const base = {
    name: "Jane Doe",
    organizationName: "Acme Growth",
    email: "jane@acme.com",
    password: "supersecret",
    confirmPassword: "supersecret",
  };

  it("accepts a well-formed sign-up", () => {
    expect(SignUpSchema.safeParse(base).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = SignUpSchema.safeParse({ ...base, confirmPassword: "different" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("confirmPassword"))).toBe(true);
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = SignUpSchema.safeParse({ ...base, password: "short", confirmPassword: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = SignUpSchema.safeParse({ ...base, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a blank organization name", () => {
    const result = SignUpSchema.safeParse({ ...base, organizationName: "  " });
    expect(result.success).toBe(false);
  });
});

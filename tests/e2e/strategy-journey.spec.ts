import { test, expect, type Page } from "@playwright/test";

/**
 * Module 2 end-to-end journey (spec section 26): sign in, open the seeded
 * Kamal Ghamry client's Strategy tool, walk the reasoning chain (cohort ->
 * situation -> buying decision -> committee -> belief -> evidence), resolve
 * AI suggestions in the review queue, check the relationship graph, and
 * confirm the readiness report. Runs against the production build + seeded
 * DB (global-setup re-seeds), so every entity referenced here comes straight
 * from prisma/seed.ts.
 */

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.fill("#email", "owner@demo-agency.test");
  await page.fill("#password", "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/overview");
}

async function demoClientId(page: Page): Promise<string> {
  await page.goto("/clients");
  await page.waitForLoadState("networkidle");
  const link = page.locator("a[href^='/c/']", { hasText: "Kamal Ghamry" }).first();
  const href = await link.getAttribute("href");
  return href!.match(/\/c\/([^/]+)/)![1];
}

test("full strategy reasoning-chain journey", async ({ page }) => {
  await signIn(page);
  const clientId = await demoClientId(page);

  // --- Strategy Overview ---
  await page.goto(`/c/${clientId}/strategy`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Strategy Intelligence Overview" })).toBeVisible();
  await expect(page.getByText("Strategy Setup Readiness")).toBeVisible();

  // --- Cohort Lab -> the seeded, fully-worked cohort ---
  await page.goto(`/c/${clientId}/strategy/cohorts`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Cohort Lab" })).toBeVisible();
  await page.getByText("Marketing managers blamed for weak sales conversion").click();
  await page.waitForLoadState("networkidle");

  // Situations tab
  await page.getByRole("tab", { name: /Situations/ }).click();
  await expect(page.getByText("CEO blames marketing after a weak sales quarter")).toBeVisible();

  // Decisions tab -> follow into the Buying Committee Mapper
  await page.getByRole("tab", { name: /Decisions/ }).click();
  await page.getByText("Approve a new marketing measurement and accountability approach").click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("CEO", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Sales Manager").first()).toBeVisible();
  await expect(page.getByText("Finance Manager").first()).toBeVisible();
  await expect(page.getByText("Sales will resist being measured on handoff speed")).toBeVisible();

  // --- Beliefs: the approved belief with strong evidence ---
  await page.goto(`/c/${clientId}/strategy/beliefs`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Belief-to-Decision Engine" })).toBeVisible();
  await page.getByText("High ROAS means marketing success.").first().click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Evidence exists")).toBeVisible();
  await expect(page.getByText(/increased contribution profit by 22%/)).toBeVisible();

  // --- AI Suggestion Review Queue ---
  await page.goto(`/c/${clientId}/strategy/reviews`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "AI Suggestion Review Queue" })).toBeVisible();
  await expect(page.getByText("duplicate?").first()).toBeVisible();

  // Approve the plausible AI-suggested cohort.
  await page.getByText("Solo consultants overwhelmed by inconsistent lead flow").click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.waitForTimeout(1000);

  // Reject the duplicate candidate.
  await page.getByText("Marketing managers blamed for poor sales results").click();
  await page.getByRole("button", { name: "Reject" }).click();
  await page.waitForTimeout(1000);

  // --- Strategic Relationship Graph ---
  await page.goto(`/c/${clientId}/strategy/relationships`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Strategic Relationship Graph" })).toBeVisible();
  await expect(page.getByText("experiences").first()).toBeVisible();

  // --- Strategy Setup Readiness ---
  await page.goto(`/c/${clientId}/strategy/readiness`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Strategy Setup Readiness" })).toBeVisible();
  await expect(page.getByText("Per-cohort breakdown")).toBeVisible();
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText("Snapshot history")).toBeVisible();
});

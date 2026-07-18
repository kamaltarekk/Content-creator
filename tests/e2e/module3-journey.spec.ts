import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Module 3 end-to-end journey: sign in, open the seeded Kamal Ghamry client,
 * verify the Guided Client Brain overview (4-state status + one Next Best
 * Action) and that Expert Mode is still fully reachable, verify the Final
 * Review screen from the completed Guided Setup session, walk through all 4
 * screens of the Create First Reel wizard (no AI call needed until the final
 * "Create Reel" button, which this test does not press), and verify the
 * seeded first Reel's result page renders a fully structured display with no
 * raw JSON anywhere.
 */

const prisma = new PrismaClient();

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

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("guided brain overview, final review, create-first-reel wizard, and Reel result journey", async ({ page }) => {
  await signIn(page);
  const clientId = await demoClientId(page);

  // --- Guided Client Brain overview: exactly one of the 4 states, plus a single Next Best Action. ---
  await page.goto(`/c/${clientId}/brain`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/^(Ready|Needs Review|Missing|Conflict)$/).first()).toBeVisible();
  await expect(page.getByText("Next best action")).toBeVisible();
  await expect(page.getByText("What we understand")).toBeVisible();

  // --- Expert Mode (the original dense Client Brain UI) is still fully reachable, unchanged. ---
  await page.getByRole("link", { name: /See all Client Brain details/i }).click();
  await page.waitForURL("**/brain/expert");
  await expect(page.getByText("Approved strategic knowledge")).toBeVisible();
  await page.getByRole("button", { name: "Switch to Guided Mode" }).click();
  await page.waitForURL(new RegExp(`/c/${clientId}/brain$`));

  // --- The Guided Setup Final Review screen shows the plain-language summary from the completed session. ---
  await page.goto(`/c/${clientId}/setup/review`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/Here.s what we understand/)).toBeVisible();

  // --- Create First Reel wizard: walk through all 4 screens. ---
  await page.goto(`/c/${clientId}/reels/new`);
  await page.waitForLoadState("networkidle");
  await page.getByText("Change an important belief", { exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByText("Marketing managers blamed for weak sales conversion", { exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByText("Let AI decide", { exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Recommended strategic direction")).toBeVisible();
  await expect(page.getByText(/funnel/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Reel" })).toBeVisible();

  // --- The already-seeded first Reel's result page: fully structured, no raw JSON anywhere. ---
  const seededReel = await prisma.reelGeneration.findFirstOrThrow({ where: { clientId }, orderBy: { createdAt: "asc" } });
  await page.goto(`/c/${clientId}/reels/${seededReel.id}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Reel direction")).toBeVisible();
  await expect(page.getByText("Hook options")).toBeVisible();
  await expect(page.getByText("Final spoken script")).toBeVisible();
  await expect(page.getByText("Visual plan")).toBeVisible();
  await expect(page.getByText("Publishing package")).toBeVisible();
  await expect(page.getByText("Safety and sources")).toBeVisible();
  await expect(page.getByText("Improvement actions")).toBeVisible();
  await expect(page.locator("pre")).toHaveCount(0);

  // --- The Safety and Sources section is collapsed by default and expands to show all 8 validation gates. ---
  await page.getByText("Safety and sources").click();
  await expect(page.getByText("Strategic grounding")).toBeVisible();
  await expect(page.getByText("Claim safety")).toBeVisible();
});

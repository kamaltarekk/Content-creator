import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end journey (spec section 20). Covers: sign in, create a client,
 * upload a CSV and wait for processing, then — on the seeded demo client,
 * which has real pending reviews and an open conflict without needing a live
 * AI key — review items, resolve the conflict, open the Client Brain, and
 * verify source traceability.
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
  // Target the seeded demo client specifically (a freshly created client would
  // sort first by recency).
  const link = page.locator("a[href^='/c/']", { hasText: "Kamal Ghamry" }).first();
  const href = await link.getAttribute("href");
  return href!.match(/\/c\/([^/]+)/)![1];
}

test("full import-to-brain journey", async ({ page }) => {
  await signIn(page);

  // --- Create a client and upload a source, then wait for processing to settle. ---
  await page.goto("/clients/new");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500); // dev-server hydration lags behind networkidle
  const stamp = Date.now();
  await page.fill("#name", `E2E Client ${stamp}`);
  await page.fill("#displayName", `E2E Client ${stamp}`);
  await page.fill("#defaultLanguage", "en");
  await page.fill("#timeZone", "UTC");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/sources\/upload$/, { timeout: 20_000 });

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500); // let the upload form hydrate
  await page.setInputFiles("#file", "sample-data/sample-source.csv");
  await page.selectOption("#sourceCategory", "STRATEGIC_FRAMEWORK");
  await page.click('button[type="submit"]');
  const sourceUrl = new RegExp("/sources/[^/]+$");
  await page.waitForURL((url) => sourceUrl.test(url.pathname) && !url.pathname.endsWith("/upload"), {
    timeout: 20_000,
  });
  const sourceId = page.url().match(/\/sources\/([^/]+)$/)![1];

  // Poll the status endpoint until processing settles into a terminal state
  // (without an AI key, classification is skipped → NEEDS_ATTENTION; either way
  // extraction ran and the source is not stuck).
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/sources/${sourceId}/status`);
        const body = await res.json();
        return body.processingStatus as string;
      },
      { timeout: 30_000, intervals: [1000] },
    )
    .toMatch(/READY_FOR_REVIEW|NEEDS_ATTENTION|COMPLETED/);

  // --- Switch to the seeded demo client for the review + conflict + brain flow. ---
  const clientId = await demoClientId(page);

  // Review queue has seeded pending items.
  await page.goto(`/c/${clientId}/reviews`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();

  // Reject the active item.
  await page.getByRole("button", { name: "Reject" }).first().click();
  await page.waitForTimeout(1500);

  // Resolve the open conflict via "Keep existing".
  await page.goto(`/c/${clientId}/brain/conflicts`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Open conflicts" })).toBeVisible();
  await page.locator("a[href*='/brain/conflicts/']").first().click();
  await page.waitForLoadState("networkidle");
  // Both values appear (existing + proposed); scope to paragraphs since the
  // proposed value is also pre-filled into the Merge textarea.
  await expect(page.getByRole("paragraph").filter({ hasText: "45,000 EGP" })).toBeVisible();
  await expect(page.getByRole("paragraph").filter({ hasText: "30,000 EGP" })).toBeVisible();
  await page.getByRole("button", { name: "Keep existing" }).click();
  await page.waitForURL("**/brain/conflicts", { timeout: 15_000 });
  await expect(page.getByText("No open conflicts")).toBeVisible();

  // --- Open the Client Brain and verify source traceability. ---
  await page.goto(`/c/${clientId}/brain`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/setup-completeness indicator/i)).toBeVisible();
  await page.getByRole("button", { name: "Positioning" }).click();
  await page.getByRole("button", { name: "View source" }).first().click();
  await expect(page.getByText("Source traceability")).toBeVisible();
  await expect(page.getByText(/Approved by/)).toBeVisible();
  await expect(page.getByText("SPB-Framework.csv")).toBeVisible();
});

import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Assumes a seeded database (run `pnpm db:seed` first) and starts
 * the dev server automatically. The pre-installed Chromium is used via
 * executablePath so no browser download is attempted.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build + start: hydration is fast and deterministic, so the
    // e2e isn't racing the dev server's on-demand compilation.
    command: "pnpm build && pnpm start -p 3000",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: true,
    timeout: 240_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a production build with the .env.test database (pnpm test:e2e wraps this in
 * dotenv -e .env.test, and explicit process env beats Next's own .env loading).
 *
 * workers: 1 is deliberate — the tests share one database and one admin account, so
 * parallel runs would interfere with each other's rate-limit and status assertions.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 5"] } }],
  webServer: {
    command: "pnpm build && pnpm start > server.log 2>&1",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});

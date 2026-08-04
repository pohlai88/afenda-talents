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
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  // On Windows, rebinding :3000 immediately after the previous run leaves lingering
  // sockets that RST the first connections. Retries absorb that transient class.
  retries: 2,
  // Port 3100: e2e runs its own production build without contending with `pnpm dev` on 3000.
  use: { baseURL: "http://localhost:3100", trace: "on-first-retry" },
  // Spec §13.6 makes the CANDIDATE UI mobile-first — those specs run on a phone profile.
  // The admin is one HR manager on a laptop, so admin specs run on desktop.
  projects: [
    {
      name: "admin-desktop",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /0[1267]-.*\.spec\.ts/,
    },
    {
      name: "candidate-mobile",
      use: { ...devices["Pixel 5"] },
      testIgnore: /0[1267]-.*\.spec\.ts/,
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start --port 3100 > server.log 2>&1",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 240_000,
  },
});

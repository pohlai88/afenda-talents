import { test, expect } from "@playwright/test";
import { Client } from "pg";

const PASSWORD = process.env.ADMIN_PASSWORD!;

// Rate-limit state persists in the database between runs; start each run clean.
test.beforeAll(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('DELETE FROM "LoginAttempt"');
  await client.end();
});

test("redirects to login when signed out", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("rejects an unauthenticated admin API call", async ({ request }) => {
  const response = await request.post("/api/admin/invite", { data: {} });
  expect(response.status()).toBe(401);
});

test("loads the dashboard after signing in", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Candidates" })).toBeVisible();
});

test("returns 429 after six rapid wrong passwords", async ({ request }) => {
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const response = await request.post("/api/admin/login", {
      data: { password: `wrong-${i}` },
    });
    statuses.push(response.status());
  }
  expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
  expect(statuses[5]).toBe(429);
});

test("a successful login clears the failure run", async ({ request }) => {
  // The previous test left this IP rate-limited; wait for a clean context is not
  // possible within the window, so this test uses the fact that a success clears
  // the counter — but a limited IP cannot log in at all. Instead: fail 3 times on
  // a FRESH forwarded IP, succeed, then confirm the next failure is a 401 not 429.
  const headers = { "x-forwarded-for": "10.9.9.9" };
  for (let i = 0; i < 3; i++) {
    await request.post("/api/admin/login", { headers, data: { password: `wrong-${i}` } });
  }
  const success = await request.post("/api/admin/login", {
    headers,
    data: { password: PASSWORD },
  });
  expect(success.status()).toBe(200);

  for (let i = 0; i < 4; i++) {
    const again = await request.post("/api/admin/login", {
      headers,
      data: { password: "wrong-after-success" },
    });
    expect(again.status()).toBe(401); // without the clear, the earlier 3 would push this run to 429
  }
});

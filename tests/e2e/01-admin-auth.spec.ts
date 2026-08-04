import { test, expect } from "@playwright/test";
import { clearLoginAttempts, signIn, ADMIN_EMAIL } from "./helpers";

const PASSWORD = process.env.ADMIN_PASSWORD!;

// This file's 429 test deliberately exhausts the shared client IP. The polluter cleans
// up so later spec files can sign in — global setup only guarantees a clean RUN start.
test.afterAll(async () => {
  await clearLoginAttempts();
});

test("redirects to login when signed out", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("rejects an unauthenticated admin API call", async ({ request }) => {
  const response = await request.post("/api/admin/invite", { data: {} });
  expect(response.status()).toBe(401);
});

test("loads the dashboard after signing in with email and password", async ({ page }) => {
  await signIn(page);
  // /admin is the operational overview; the candidate registry lives at /admin/candidates.
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("rejects a valid password with the wrong email", async ({ request }) => {
  // Own forwarded IP: this failure must not count against the 429 test's budget.
  const response = await request.post("/api/admin/login", {
    headers: { "x-forwarded-for": "10.8.8.8" },
    data: { email: "someone-else@example.com", password: PASSWORD },
  });
  expect(response.status()).toBe(401);
});

test("returns 429 after six rapid wrong passwords", async ({ request }) => {
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const response = await request.post("/api/admin/login", {
      data: { email: ADMIN_EMAIL, password: `wrong-${i}` },
    });
    statuses.push(response.status());
  }
  expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
  expect(statuses[5]).toBe(429);
});

test("a successful login clears the failure run", async ({ request }) => {
  const headers = { "x-forwarded-for": "10.9.9.9" };
  for (let i = 0; i < 3; i++) {
    await request.post("/api/admin/login", {
      headers,
      data: { email: ADMIN_EMAIL, password: `wrong-${i}` },
    });
  }
  const success = await request.post("/api/admin/login", {
    headers,
    data: { email: ADMIN_EMAIL, password: PASSWORD },
  });
  expect(success.status()).toBe(200);

  for (let i = 0; i < 4; i++) {
    const again = await request.post("/api/admin/login", {
      headers,
      data: { email: ADMIN_EMAIL, password: "wrong-after-success" },
    });
    expect(again.status()).toBe(401); // without the clear, the earlier 3 would push this run to 429
  }
});

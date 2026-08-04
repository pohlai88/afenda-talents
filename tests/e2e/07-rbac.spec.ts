import { test, expect } from "@playwright/test";
import { signIn, invite, withDb } from "./helpers";

/**
 * The RBAC matrix (DECISIONS.md D15): VIEWER reads, ADMIN acts. Each denial is
 * asserted at the API layer — hiding buttons is UX, the 403 is the security boundary.
 */

test("an admin creates a viewer; the viewer can read but not act", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  await signIn(page);

  // Admin creates the viewer account through the UI and captures the temp password.
  await page.goto("/admin/users");
  await page.getByLabel("Name").fill(`Viewer-${stamp}`);
  await page.getByLabel("Email", { exact: true }).fill(`viewer+${stamp}@example.com`);
  // Role is a shadcn Select; VIEWER is the default. Assert it rather than driving it.
  await expect(page.getByLabel("Role")).toContainText(/viewer/i);
  await page.getByRole("button", { name: "Create account" }).click();
  const notice = await page.getByRole("status").textContent();
  const tempPassword = notice!.match(/Temporary password for [^:]+: ([A-Za-z0-9_-]+)/)![1];

  // Something for the viewer to look at.
  await invite(page, `Seen-${stamp}`, `seen+${stamp}@example.com`);

  // Fresh browser context: the viewer signs in with the temp password.
  const viewerContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  await viewer.goto("/admin/login");
  await viewer.getByLabel("Email", { exact: true }).fill(`viewer+${stamp}@example.com`);
  await viewer.getByLabel("Password").fill(tempPassword);
  await viewer.getByRole("button", { name: "Sign in" }).click();

  // An admin-issued password authenticates exactly one page: the forced change.
  // Login pushes /admin; the shell layout bounces to the change page.
  await expect(viewer).toHaveURL(/\/admin\/change-password$/, { timeout: 10_000 });
  const ownPassword = `viewer-own-${stamp}`;
  await viewer.getByLabel("Temporary password").fill(tempPassword);
  await viewer.getByLabel("New password", { exact: true }).fill(ownPassword);
  await viewer.getByLabel("Repeat new password").fill(ownPassword);
  await viewer.getByRole("button", { name: "Save new password" }).click();
  await expect(viewer).toHaveURL(/\/admin$/);

  // Reads work: the registry shows the candidate…
  await viewer.goto("/admin/candidates");
  await expect(viewer.getByRole("row", { name: new RegExp(`seen\\+${stamp}`) })).toBeVisible();
  // …but every mutating control is absent.
  await expect(viewer.getByRole("button", { name: "Invite candidates" })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "Revoke" })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "Delete all candidate data" })).toHaveCount(0);

  // And the API enforces what the UI hides — 403 on every mutation and on export.
  const deny = async (path: string, method: "GET" | "POST" | "DELETE", data?: object) => {
    const response = await viewer.request.fetch(path, { method, data });
    expect(response.status(), `${method} ${path}`).toBe(403);
  };
  await deny("/api/admin/invite", "POST", {
    candidates: [{ fullName: "X", email: `x+${stamp}@example.com` }],
  });
  await deny("/api/admin/export", "GET");
  await deny("/api/admin/purge", "POST", { confirmation: "DELETE ALL CANDIDATE DATA" });
  await deny("/api/admin/users", "GET");
  await deny("/api/admin/users", "POST", {
    name: "E",
    email: `e+${stamp}@example.com`,
    role: "ADMIN",
  });

  // The users page bounces viewers back to the dashboard.
  await viewer.goto("/admin/users");
  await expect(viewer).toHaveURL(/\/admin$/);

  // The data page bounces viewers back to the overview too.
  await viewer.goto("/admin/data");
  await expect(viewer).toHaveURL(/\/admin$/);

  await viewerContext.close();

  // Cleanup: the admin removes the viewer account.
  const viewerId = await withDb(async (db) =>
    (
      await db.query('SELECT id FROM "User" WHERE email = $1', [`viewer+${stamp}@example.com`])
    ).rows[0]?.id,
  );
  const removed = await page.request.delete(`/api/admin/users/${viewerId}`);
  expect(removed.ok()).toBeTruthy();
});

test("an admin cannot demote or remove their own account", async ({ page }) => {
  await signIn(page);
  const selfId = await withDb(async (db) =>
    (
      await db.query('SELECT id FROM "User" WHERE email = $1', [process.env.ADMIN_EMAIL])
    ).rows[0].id,
  );

  const demote = await page.request.patch(`/api/admin/users/${selfId}`, {
    data: { role: "VIEWER" },
  });
  expect(demote.status()).toBe(409);

  const remove = await page.request.delete(`/api/admin/users/${selfId}`);
  expect(remove.status()).toBe(409);
});

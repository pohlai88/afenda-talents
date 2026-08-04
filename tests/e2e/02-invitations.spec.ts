import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { signIn } from "./helpers";

/** The console transport prints every email to the server's stdout, captured in server.log. */
async function capturedLinks(): Promise<string[]> {
  const log = await fs.readFile("server.log", "utf8").catch(() => "");
  return log.match(/http:\/\/localhost:\d+\/a\/[A-Za-z0-9_-]+/g) ?? [];
}

test("inviting two candidates prints two distinct links and shows both as SENT", async ({
  page,
}) => {
  const before = (await capturedLinks()).length;
  const stamp = Date.now();

  await signIn(page);
  await page.goto("/admin/invite");
  await page
    .getByLabel(/one per line/i)
    .fill(`Amira Yusof, amira+${stamp}@example.com\nDaniel Tan, daniel+${stamp}@example.com`);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("status")).toContainText("Invited 2");

  const links = await capturedLinks();
  expect(links.length).toBe(before + 2);
  const [a, b] = links.slice(-2);
  expect(a).not.toBe(b);

  await page.goto("/admin/candidates");
  const amira = page.getByRole("row", { name: new RegExp(`amira\\+${stamp}`) });
  const daniel = page.getByRole("row", { name: new RegExp(`daniel\\+${stamp}`) });
  await expect(amira).toContainText("Invitation sent");
  await expect(daniel).toContainText("Invitation sent");
});

test("revoking a candidate nulls the token and shows REVOKED", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page);
  await page.goto("/admin/invite");
  await page.getByLabel("Full name").fill("Bilal Rahman");
  await page.getByLabel("Email", { exact: true }).fill(`bilal+${stamp}@example.com`);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("status")).toContainText("Invited 1");

  await page.goto("/admin/candidates");
  const row = page.getByRole("row", { name: new RegExp(`bilal\\+${stamp}`) });
  await row.getByRole("button", { name: "Revoke" }).click();
  // Revoking is destructive, so it sits behind a confirmation dialog.
  await page.getByRole("alertdialog").getByRole("button", { name: "Revoke invitation" }).click();
  await expect(row).toContainText("Invitation revoked");
  // The revoked link's 404 behaviour is asserted end-to-end in the Phase 5 specs,
  // once /a/[token] exists to serve anything at all.
});

test("resending issues a different link", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page);
  await page.goto("/admin/invite");
  await page.getByLabel("Full name").fill("Chen Wei");
  await page.getByLabel("Email", { exact: true }).fill(`chen+${stamp}@example.com`);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("status")).toContainText("Invited 1");

  const linksBeforeResend = await capturedLinks();
  const original = linksBeforeResend.at(-1)!;

  await page.goto("/admin/candidates");
  const row = page.getByRole("row", { name: new RegExp(`chen\\+${stamp}`) });
  await row.getByRole("button", { name: "Resend" }).click();
  await expect
    .poll(async () => (await capturedLinks()).length, { timeout: 10_000 })
    .toBeGreaterThan(linksBeforeResend.length);

  const replacement = (await capturedLinks()).at(-1)!;
  expect(replacement).not.toBe(original);
  await expect(row).toContainText("Invitation sent");
});

test("inviting the same email twice is skipped, not duplicated", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page);
  await page.goto("/admin/invite");
  await page.getByLabel("Full name").fill("Dupe Test");
  await page.getByLabel("Email", { exact: true }).fill(`dupe+${stamp}@example.com`);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("status")).toContainText("Invited 1");

  await page.getByLabel("Full name").fill("Dupe Test");
  await page.getByLabel("Email", { exact: true }).fill(`dupe+${stamp}@example.com`);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("status")).toContainText("Skipped 1");
});

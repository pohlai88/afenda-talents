import { test, expect } from "@playwright/test";
import { signIn, invite } from "./helpers";

/**
 * The registry's operational contract (requirements §7): find a candidate, narrow the
 * list, and act on a row. Every piece of list state must survive a reload, because it
 * lives in the URL.
 */
test("search, filter, and shortcut state all live in the URL", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page);
  await invite(page, `Findable-${stamp}`, `findable+${stamp}@example.com`);

  await page.goto("/admin/candidates");
  await expect(page.getByRole("row", { name: new RegExp(`findable\\+${stamp}`) })).toBeVisible();

  // Search narrows to the one candidate and survives a reload.
  await page.getByLabel("Search").fill(`findable+${stamp}`);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/[?&]q=/);
  await page.reload();
  await expect(page.getByRole("row", { name: new RegExp(`findable\\+${stamp}`) })).toBeVisible();

  // A search that matches nobody gets its own recovery state.
  await page.getByLabel("Search").fill(`nobody-${stamp}`);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText(/nothing matches/i)).toBeVisible();
  await page.getByRole("button", { name: "Show all candidates" }).click();
  await expect(page).toHaveURL(/\/admin\/candidates$/);

  // A shortcut is a pressed toggle that writes to the URL.
  const readyShortcut = page.getByRole("button", { name: "Ready for review" });
  await readyShortcut.click();
  await expect(page).toHaveURL(/[?&]view=ready-for-review/);
  await expect(readyShortcut).toHaveAttribute("aria-pressed", "true");
});

test("statuses read as sentences and never as raw codes", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page);
  await invite(page, `Worded-${stamp}`, `worded+${stamp}@example.com`);

  await page.goto("/admin/candidates");
  const row = page.getByRole("row", { name: new RegExp(`worded\\+${stamp}`) });
  await expect(row).toContainText("Invitation sent");
  await expect(row).not.toContainText("SENT");
});

test("deleting a candidate requires confirmation and removes the row", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page);
  await invite(page, `Doomed-${stamp}`, `doomed+${stamp}@example.com`);

  await page.goto("/admin/candidates");
  const row = page.getByRole("row", { name: new RegExp(`doomed\\+${stamp}`) });
  await row.getByRole("button", { name: /more actions/i }).click();
  await page.getByRole("menuitem", { name: /delete candidate and assessment data/i }).click();

  // The dialog must name the consequence, not just the object.
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(/answers/i);
  await dialog.getByRole("button", { name: "Delete candidate" }).click();

  await expect(page.getByRole("row", { name: new RegExp(`doomed\\+${stamp}`) })).toHaveCount(0);
});

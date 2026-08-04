import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";

const PASSWORD = process.env.ADMIN_PASSWORD!;

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function latestLink(): Promise<string> {
  const log = await fs.readFile("server.log", "utf8");
  return (log.match(/http:\/\/localhost:3000\/a\/[A-Za-z0-9_-]+/g) ?? []).at(-1)!;
}

/** Walks a candidate through the whole assessment so a Result exists to inspect. */
async function completeAssessment(page: Page, name: string, email: string) {
  await page.goto("/admin/invite");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("status")).toContainText("Invited 1");

  const link = await latestLink();
  await page.goto(link);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start the assessment" }).click();

  const groups = page.locator("li[id^='item-']");
  for (let i = 0; i < 34; i++) {
    // Alternate answers so the straight-lining flag is not triggered by the fixture.
    const label = i % 2 === 0 ? /: Agree$/ : /: Neither agree nor disagree$/;
    await groups.nth(i).getByRole("button", { name: label }).click();
  }
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page).toHaveURL(/\/done$/, { timeout: 15_000 });
}

test("spec §15 step 5: the profile shows five dimensions, bands, flags, and item responses", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const name = `Hana-${stamp}`;
  await signIn(page);
  await completeAssessment(page, name, `hana+${stamp}@example.com`);

  await page.goto("/admin");
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(/\/admin\/candidate\//);

  // Five dimensions with band labels.
  for (const dimension of [
    "Work ethic and reliability",
    "Communication and collaboration",
    "Problem solving and learning agility",
    "Adaptability and resilience",
    "Integrity and accountability",
  ]) {
    await expect(page.getByText(dimension)).toBeVisible();
  }

  // All four validity chips, neutrally phrased.
  await expect(page.getByText("Impression management:")).toBeVisible();
  await expect(page.getByText("Consistency:")).toBeVisible();
  await expect(page.getByText("Answer variation:")).toBeVisible();
  await expect(page.getByText("Time on task:", { exact: true })).toBeVisible();

  // Timing is attributed, and the framing text is present.
  await expect(page.getByText(/Self-reported time on task/).first()).toBeVisible();
  await expect(page.getByText(/one input into a hiring decision/)).toBeVisible();

  // The framing disclaims scores and rankings, and no overall number is presented.
  // ("ranking" may only appear inside that negation.)
  await expect(page.getByText(/not a test score, a ranking, or a recommendation/)).toBeVisible();
  await expect(page.getByText(/overall/i)).toHaveCount(0);
  await expect(page.getByText(/rank/i)).toHaveCount(1);

  // Item-level table opens on demand.
  await page.getByRole("button", { name: /Show item-level responses/ }).click();
  await expect(
    page.getByRole("cell", { name: "I complete tasks by the deadline I commit to." }),
  ).toBeVisible();

  // The audit trail recorded the view without storing a name or an email.
  // (Asserted properly in the Phase 7 spec; here we just confirm the page loaded scored data.)
  await expect(page.getByText(/· Effective|· Strong|· Developing/).first()).toBeVisible();

  // Print media: the toggle disappears and the item table is unconditionally present,
  // approximating the spec's Ctrl+P check. A real print run stays a Phase 8 manual step.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: /item-level responses/ })).toBeHidden();
  await expect(
    page.getByRole("cell", { name: "I keep track of my responsibilities without being reminded." }),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
});

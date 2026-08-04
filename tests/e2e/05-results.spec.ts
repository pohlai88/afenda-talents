import { test, expect } from "@playwright/test";
import { signIn, invite, completeAssessment } from "./helpers";

test("spec §15 step 5: the profile shows five dimensions, bands, flags, and item responses", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const name = `Hana-${stamp}`;
  await signIn(page);
  const link = await invite(page, name, `hana+${stamp}@example.com`);
  await completeAssessment(page, link);
  await signIn(page); // submission cleared the candidate cookie; sign back in

  await page.goto("/admin/candidates");
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(/\/admin\/candidate\//);

  // Five dimensions with band labels (scale aria-label).
  for (const dimension of [
    "Work ethic and reliability",
    "Communication and collaboration",
    "Problem solving and learning agility",
    "Adaptability and resilience",
    "Integrity and accountability",
  ]) {
    await expect(page.getByRole("img", { name: new RegExp(dimension) })).toBeVisible();
  }

  // Response-context indicators, neutrally titled (UI §8.4).
  await expect(page.getByText("Impression management", { exact: true })).toBeVisible();
  await expect(page.getByText("Response consistency", { exact: true })).toBeVisible();
  await expect(page.getByText("Answer variation", { exact: true })).toBeVisible();
  await expect(page.getByText("Time on task", { exact: true })).toBeVisible();
  await expect(page.getByText(/Not observed|Review context/).first()).toBeVisible();

  // Timing is attributed, and the framing text is present.
  await expect(page.getByText(/Self-reported active time/i).first()).toBeVisible();
  await expect(page.getByText(/Server-observed elapsed window/i).first()).toBeVisible();
  await expect(page.getByText(/one input into a hiring decision/)).toBeVisible();

  // The framing disclaims scores and rankings; the only “overall” is the disclaimer.
  await expect(page.getByText(/not a test score, a ranking, or a recommendation/)).toBeVisible();
  await expect(page.getByText(/No overall score/)).toBeVisible();
  await expect(page.getByText(/rank/i)).toHaveCount(1);

  // Item-level table opens on demand.
  await page.getByRole("button", { name: /Show item-level responses/ }).click();
  await expect(
    page.getByRole("cell", { name: "I complete tasks by the deadline I commit to." }),
  ).toBeVisible();

  // The audit trail recorded the view without storing a name or an email.
  // (Asserted properly in the Phase 7 spec; here we just confirm the page loaded scored data.)
  // Band labels on the scale.
  await expect(page.getByText(/Effective band|Strong band|Developing band/).first()).toBeVisible();

  // Print media: the toggle disappears and the item table is unconditionally present,
  // approximating the spec's Ctrl+P check. A real print run stays a Phase 8 manual step.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: /item-level responses/ })).toBeHidden();
  await expect(
    page.getByRole("cell", { name: "I keep track of my responsibilities without being reminded." }),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
});

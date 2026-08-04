import { expect, test } from "@playwright/test";
import { invite, signIn } from "./helpers";

/**
 * Data & audit explorer (UI §11) — admin desktop. Light a11y: labelled filters,
 * landmarks, and no nested main.
 */
test("audit explorer lists events, filters by action, and keeps filters labelled", async ({
	page,
}) => {
	const stamp = Date.now();
	await signIn(page);
	await invite(page, `Audit-${stamp}`, `audit+${stamp}@example.com`);

	await page.goto("/admin/data");
	await expect(
		page.getByRole("heading", { name: "Data & audit" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Audit activity" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Data retention and deletion" }),
	).toBeVisible();

	// One main landmark on the shell page.
	await expect(page.locator("main")).toHaveCount(1);

	await expect(page.getByLabel("Action")).toBeVisible();
	await expect(page.getByLabel("From date")).toBeVisible();
	await expect(page.getByLabel("To date")).toBeVisible();

	await expect(
		page.getByRole("cell", { name: "Invitation created" }).first(),
	).toBeVisible();
	await expect(page.getByRole("cell", { name: "Signed in" }).first()).toBeVisible();

	// Filter to invitation created only.
	await page.getByLabel("Action").click();
	await page.getByRole("option", { name: "Invitation created" }).click();
	await expect(page.getByText(/Showing \d+ of \d+ events/)).toBeVisible();
	await expect(
		page.getByRole("cell", { name: "Invitation created" }).first(),
	).toBeVisible();

	await page.getByRole("button", { name: "Clear filters" }).click();

	await expect(
		page.getByRole("heading", { name: "Retention summary" }),
	).toBeVisible();
	await expect(page.getByText(/Configured period:/)).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Delete all candidate data" }),
	).toBeDisabled();
});

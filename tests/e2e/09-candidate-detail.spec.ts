import { expect, test } from "@playwright/test";
import { completeAssessment, invite, signIn } from "./helpers";

test("unscored candidate detail opens from View progress without 404", async ({
	page,
}) => {
	test.setTimeout(120_000);
	const stamp = Date.now();
	const name = `DetailSent-${stamp}`;
	await signIn(page);
	await invite(page, name, `detail-sent+${stamp}@example.com`);

	await page.goto("/admin/candidates");
	await page.getByRole("link", { name: new RegExp(name) }).click();
	await expect(page).toHaveURL(/\/admin\/candidate\//);
	await expect(page.getByRole("heading", { name })).toBeVisible();
	await expect(page.getByText("Invitation sent").first()).toBeVisible();
	await expect(page.getByText("Progress")).toBeVisible();
	await expect(page.getByText("Activity")).toBeVisible();
	await expect(
		page.getByText("Invitation sent", { exact: true }).first(),
	).toBeVisible();
	// No scored profile body.
	await expect(page.getByText("Work ethic and reliability")).toHaveCount(0);
});

test("scored candidate detail still shows profile, timeline, and print", async ({
	page,
}) => {
	test.setTimeout(180_000);
	const stamp = Date.now();
	const name = `DetailScored-${stamp}`;
	await signIn(page);
	const link = await invite(page, name, `detail-scored+${stamp}@example.com`);
	await completeAssessment(page, link);
	await signIn(page);

	await page.goto("/admin/candidates");
	await page.getByRole("link", { name: new RegExp(name) }).click();
	await expect(page).toHaveURL(/\/admin\/candidate\//);
	await expect(page.getByRole("heading", { name })).toBeVisible();
	await expect(
		page.getByRole("img", { name: /Work ethic and reliability/ }),
	).toBeVisible();
	await expect(page.getByText("Response context")).toBeVisible();
	await expect(page.getByText("Activity")).toBeVisible();
	await expect(
		page.getByRole("button", { name: /Print profile/ }),
	).toBeVisible();
	await expect(
		page.getByText(/one input into a hiring decision/),
	).toBeVisible();
});

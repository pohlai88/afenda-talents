import { test, expect, type Page } from "@playwright/test";
import { allLinks, invite, signIn } from "./helpers";

/**
 * Reads the assignment id used by invite revoke/resend APIs (D18).
 * Rows expose data-assignment-id; fall back to data-candidate-id during expand.
 */
async function idFor(page: Page, name: string): Promise<string> {
	await page.goto("/admin/candidates");
	const row = page.getByRole("row", { name: new RegExp(name) });
	await expect(row).toBeVisible();
	const id =
		(await row.getAttribute("data-assignment-id")) ??
		(await row.getAttribute("data-candidate-id"));
	expect(id).toBeTruthy();
	return id!;
}

test("spec §15 step 6: a revoked candidate's link lands on the completion page", async ({
	page,
	context,
}) => {
	await signIn(page);
	const stamp = Date.now();
	const name = `Farah-${stamp}`;
	const link = await invite(page, name, `farah+${stamp}@example.com`);

	// The link works before revocation…
	const candidatePage = await context.newPage();
	await candidatePage.goto(link);
	await expect(
		candidatePage.getByRole("heading", { name: "Before you begin" }),
	).toBeVisible();

	// …and dies on the next request after it. (Revocation via the API: the dashboard row
	// buttons are already covered on desktop in the 02 spec; this project runs on a phone.)
	const response = await page.request.post(
		`/api/admin/invite/${await idFor(page, name)}/revoke`,
	);
	expect(response.ok()).toBeTruthy();

	await candidatePage.goto(link);
	await expect(candidatePage).toHaveURL(/\/done$/);
});

test("spec §15 step 7: after a resend the old link fails and the new one works", async ({
	page,
	context,
}) => {
	await signIn(page);
	const stamp = Date.now();
	const name = `Gopal-${stamp}`;
	const original = await invite(page, name, `gopal+${stamp}@example.com`);

	const before = (await allLinks()).length;
	const response = await page.request.post(
		`/api/admin/invite/${await idFor(page, name)}/resend`,
	);
	expect(response.ok()).toBeTruthy();
	await expect
		.poll(async () => (await allLinks()).length)
		.toBeGreaterThan(before);
	const replacement = (await allLinks()).at(-1)!;
	expect(replacement).not.toBe(original);

	const candidatePage = await context.newPage();
	await candidatePage.goto(original);
	await expect(candidatePage).toHaveURL(/\/done$/);

	await candidatePage.goto(replacement);
	await expect(
		candidatePage.getByRole("heading", { name: "Before you begin" }),
	).toBeVisible();
});

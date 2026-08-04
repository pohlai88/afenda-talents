import fs from "node:fs/promises";
import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

const PASSWORD = process.env.ADMIN_PASSWORD!;

/**
 * Deletes rate-limit rows so specs start unthrottled. The embedded-postgres server is
 * stable, but the error listener stays: pg emits async socket errors that would
 * otherwise crash the worker outside any try/catch.
 */
export async function clearLoginAttempts(retries = 5): Promise<void> {
	for (let attempt = 1; ; attempt++) {
		const client = new Client({ connectionString: process.env.DATABASE_URL });
		client.on("error", () => {});
		try {
			await client.connect();
			await client.query('DELETE FROM "LoginAttempt"');
			await client.end();
			return;
		} catch (error) {
			await client.end().catch(() => {});
			if (attempt >= retries) throw error;
			await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
		}
	}
}

export async function withDb<T>(
	fn: (client: Client) => Promise<T>,
): Promise<T> {
	const client = new Client({ connectionString: process.env.DATABASE_URL });
	client.on("error", () => {});
	await client.connect();
	try {
		return await fn(client);
	} finally {
		await client.end();
	}
}

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

export async function signIn(
	page: Page,
	email: string = ADMIN_EMAIL,
	password: string = PASSWORD,
): Promise<void> {
	await page.goto("/admin/login");
	await page.getByLabel("Email", { exact: true }).fill(email);
	await page.getByLabel("Password").fill(password);
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page).toHaveURL(/\/admin$/);
}

export async function allLinks(): Promise<string[]> {
	const log = await fs.readFile("server.log", "utf8").catch(() => "");
	return log.match(/http:\/\/localhost:\d+\/a\/[A-Za-z0-9_-]+/g) ?? [];
}

/** Invites one candidate and returns the invitation link from the console transport. */
export async function invite(
	page: Page,
	name: string,
	email: string,
): Promise<string> {
	const before = (await allLinks()).length;
	await page.goto("/admin/invite");
	await page.getByLabel("Full name").fill(name);
	await page.getByLabel("Email", { exact: true }).fill(email);
	await page.getByRole("button", { name: "Review invitation" }).click();
	await page.getByRole("button", { name: /Send 1 invitation/ }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Send invitations" })
		.click();
	await expect(page.getByRole("status")).toContainText("Invited 1");
	await expect
		.poll(async () => (await allLinks()).length)
		.toBeGreaterThan(before);
	return (await allLinks()).at(-1)!;
}

/** Walks an invited candidate through consent and all 34 items to submission. */
export async function completeAssessment(
	page: Page,
	link: string,
): Promise<void> {
	await page.goto(link);
	await page.getByRole("checkbox").check();
	await page.getByRole("button", { name: "Start the assessment" }).click();

	const groups = page.locator("li[id^='item-']");
	for (let i = 0; i < 34; i++) {
		// Alternate answers so the straight-lining flag is not triggered by the fixture.
		const label = i % 2 === 0 ? /: Agree$/ : /: Neither agree nor disagree$/;
		await groups.nth(i).getByRole("button", { name: label }).click();
	}
	await page.waitForTimeout(1500); // let the last debounce flush
	await page.getByRole("button", { name: "Submit" }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Submit assessment" })
		.click();
	await expect(page).toHaveURL(/\/done$/, { timeout: 15_000 });
}

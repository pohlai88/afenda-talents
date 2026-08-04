import fs from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { fillSingleInvite, signIn } from "./helpers";

async function inviteAndGetLink(
	page: Page,
	name: string,
	email: string,
): Promise<string> {
	const before = (
		(await fs.readFile("server.log", "utf8").catch(() => "")).match(
			/http:\/\/localhost:\d+\/a\/[A-Za-z0-9_-]+/g,
		) ?? []
	).length;

	await signIn(page);

	await page.goto("/admin/invite");
	await fillSingleInvite(page, name, email);
	await page.getByRole("button", { name: "Review invitation" }).click();
	await page.getByRole("button", { name: /Send 1 invitation/ }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Send invitations" })
		.click();
	await expect(page.getByRole("status")).toContainText("Invited 1");

	let links: string[] = [];
	await expect
		.poll(async () => {
			links =
				(await fs.readFile("server.log", "utf8").catch(() => "")).match(
					/http:\/\/localhost:\d+\/a\/[A-Za-z0-9_-]+/g,
				) ?? [];
			return links.length;
		})
		.toBeGreaterThan(before);
	return links[links.length - 1];
}

test("spec §15 steps 3–4: consent, answer, close browser, resume intact, submit, link dies", async ({
	page,
	context,
}) => {
	test.setTimeout(180_000);
	const stamp = Date.now();
	const candidateName = `Amira-${stamp}`;
	const link = await inviteAndGetLink(
		page,
		candidateName,
		`amira+${stamp}@example.com`,
	);

	// Consent is captured before the first item is shown, and names collection, audience,
	// and retention (PDPA, spec §13.7).
	const candidate = await context.newPage();
	await candidate.goto(link);
	await expect(
		candidate.getByRole("heading", { name: "Before you begin" }),
	).toBeVisible();
	await expect(candidate.getByText("What we collect")).toBeVisible();
	await expect(candidate.getByText("How long we keep it")).toBeVisible();

	const startButton = candidate.getByRole("button", {
		name: "Start the assessment",
	});
	await expect(startButton).toBeDisabled();
	await candidate.getByRole("checkbox").check();
	await startButton.click();
	await expect(
		candidate.getByRole("heading", { name: "Your self-assessment" }),
	).toBeVisible();

	// Answer the first 17 items, then abandon the tab entirely.
	const groups = candidate.locator("li[id^='item-']");
	for (let i = 0; i < 17; i++) {
		await groups.nth(i).getByRole("radio", { name: /^Agree$/ }).check();
	}
	await candidate.waitForTimeout(1500); // let the debounce flush
	await candidate.close();

	// Reopen the same link — every prior answer must be restored.
	const resumed = await context.newPage();
	await resumed.goto(link);
	await expect(
		resumed.getByRole("heading", { name: "Your self-assessment" }),
	).toBeVisible();
	await expect(
		resumed.getByText("Your previous answers were restored"),
	).toBeVisible();
	await expect(resumed.getByText("17 of 34 answered").first()).toBeVisible();

	// Submitting with items outstanding is rejected and the gaps are highlighted.
	await resumed.getByRole("button", { name: "Submit" }).click();
	await expect(
		resumed.getByText("Please answer this one.").first(),
	).toBeVisible();
	await expect(
		resumed.getByRole("heading", { name: "Your self-assessment" }),
	).toBeVisible();

	const remaining = resumed.locator("li[id^='item-']");
	for (let i = 17; i < 34; i++) {
		await remaining.nth(i).getByRole("radio", { name: /^Disagree$/ }).check();
	}
	await resumed.waitForTimeout(1500);
	await resumed.getByRole("button", { name: "Submit" }).click();
	await resumed
		.getByRole("alertdialog")
		.getByRole("button", { name: "Submit assessment" })
		.click();
	await expect(resumed).toHaveURL(/\/done$/, { timeout: 15_000 });
	await expect(
		resumed.getByRole("heading", { name: "Thank you" }),
	).toBeVisible();

	// The used link lands on the completion page, not the questions (spec §15 step 4).
	await resumed.goto(link);
	await expect(resumed).toHaveURL(/\/done$/);

	// And the admin now sees the candidate as SCORED with a clickable profile.
	// This spec runs on the mobile project; the registry shows cards, not table rows.
	await page.goto("/admin/candidates");
	await page.getByLabel("Search").fill(candidateName);
	await expect(page.getByRole("link", { name: candidateName })).toBeVisible();
	await expect(
		page.locator("li").filter({ hasText: candidateName }),
	).toContainText("Ready for review");
});

test("a garbage token lands on the completion page and reveals nothing", async ({
	context,
}) => {
	const probe = await context.newPage();
	await probe.goto("/a/not-a-real-token-at-all");
	await expect(probe).toHaveURL(/\/done$/);
	await expect(probe.getByRole("heading", { name: "Thank you" })).toBeVisible();
});

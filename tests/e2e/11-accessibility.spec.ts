import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./a11y";
import { completeAssessment, invite, signIn, withDb } from "./helpers";

test.describe("accessibility — WCAG AA smoke", () => {
	test("admin login has no axe violations", async ({ page }) => {
		await page.goto("/admin/login");
		await expect(page.getByRole("heading", { name: "Hiring team sign in" })).toBeVisible();
		await expectNoA11yViolations(page, "admin login");
	});

	test("invite page is keyboard-usable and axe-clean", async ({ page }) => {
		await signIn(page);
		await page.goto("/admin/invite");
		await expect(page.getByRole("heading", { name: "Invite candidates" })).toBeVisible();
		await expectNoA11yViolations(page, "invite (empty)");
		await page.getByRole("tab", { name: "Add many" }).focus();
		await page.keyboard.press("Enter");
		await expect(page.getByRole("tab", { name: "Add many" })).toHaveAttribute("aria-selected", "true");
		await page.getByRole("tab", { name: "Single candidate" }).focus();
		await page.keyboard.press("Enter");
		const single = page.getByRole("tabpanel", { name: "Single candidate" });
		await single.getByLabel("Full name").fill("A11y Invite");
		await single.getByLabel("Email", { exact: true }).fill(`a11y-invite+${Date.now()}@example.com`);
		await page.getByRole("button", { name: "Review invitation" }).focus();
		await page.keyboard.press("Enter");
		await expect(page.getByText("Review before sending")).toBeVisible();
		await expect(page.getByRole("button", { name: /Send 1 invitation/ })).toBeVisible();
		await expectNoA11yViolations(page, "invite (review list)");
	});

	test("candidates workspace axe-clean", async ({ page }) => {
		await signIn(page);
		await page.goto("/admin/candidates");
		await expect(page.getByRole("heading", { name: /candidates/i })).toBeVisible();
		await expectNoA11yViolations(page, "candidates workspace");
	});

	test("candidate detail progress is axe-clean", async ({ page }) => {
		test.setTimeout(120_000);
		const stamp = Date.now();
		const progressName = `A11yProgress-${stamp}`;
		await signIn(page);
		await invite(page, progressName, `a11y-progress+${stamp}@example.com`);
		await page.goto("/admin/candidates");
		await page.getByRole("link", { name: new RegExp(progressName) }).click();
		await expect(page.getByRole("heading", { name: progressName })).toBeVisible();
		await expect(page.getByText(/Back to candidates/)).toBeVisible();
		await expectNoA11yViolations(page, "candidate detail progress");
	});

	test("scored profile responses disclosure is keyboard operable and axe-clean", async ({ page }) => {
		test.setTimeout(180_000);
		const stamp = Date.now();
		const scoredName = `A11yScored-${stamp}`;
		await signIn(page);
		const link = await invite(page, scoredName, `a11y-scored+${stamp}@example.com`);
		await completeAssessment(page, link);
		await signIn(page);
		await page.goto("/admin/candidates");
		await page.getByRole("link", { name: new RegExp(scoredName) }).click();
		await expect(page.getByRole("heading", { name: scoredName })).toBeVisible();
		const disclose = page.getByRole("button", { name: /item-level responses/ });
		await expect(disclose).toHaveAttribute("aria-expanded", "false");
		await disclose.focus();
		await page.keyboard.press("Enter");
		await expect(disclose).toHaveAttribute("aria-expanded", "true");
		await expect(disclose).toHaveAccessibleName(/Hide item-level responses/);
		await expect(page.getByRole("navigation", { name: "Jump to dimension" })).toBeVisible();
		await expectNoA11yViolations(page, "candidate detail scored");
	});

	test("candidate consent, assessment, and done are axe-clean", async ({ page }) => {
		test.setTimeout(120_000);
		const stamp = Date.now();
		await signIn(page);
		const link = await invite(page, `A11yCand-${stamp}`, `a11y-cand+${stamp}@example.com`);
		await page.goto(link);
		await expect(page.getByRole("heading", { name: "Before you begin" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Skip to content" })).toBeAttached();
		await expectNoA11yViolations(page, "candidate consent");
		await page.getByRole("checkbox").check();
		await page.getByRole("button", { name: "Start the assessment" }).click();
		await expect(page.getByRole("heading", { name: "Your self-assessment" })).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole("progressbar", { name: "Assessment progress" })).toBeVisible();
		await expectNoA11yViolations(page, "candidate assessment");
		await page.goto(`/a/not-a-real-token/done`);
		await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
		await expectNoA11yViolations(page, "candidate done");
	});

	test("Corporate overview, registers, and help are axe-clean", async ({ page }) => {
		await signIn(page);
		const pages = [
			["/admin/corporate", "Administration control centre"],
			["/admin/corporate/obligations", "Obligations"],
			["/admin/corporate/counterparties", "Counterparties"],
			["/admin/corporate/payments", "Payments"],
			["/admin/corporate/custom-fields", "Custom fields"],
			["/admin/corporate/help", "Help & operating manual"],
		] as const;

		for (const [url, heading] of pages) {
			await page.goto(url);
			await expect(page.getByRole("heading", { name: heading })).toBeVisible();
			await expect(page.getByRole("link", { name: "Skip to content" })).toBeAttached();
			await expectNoA11yViolations(page, `corporate ${heading}`);
		}
	});

	test("Corporate filters and contextual help are keyboard-operable and axe-clean", async ({ page }) => {
		await signIn(page);
		await page.goto("/admin/corporate/obligations");
		const search = page.getByRole("searchbox", { name: "Search obligations" });
		await search.focus();
		await search.fill("Accessibility Test");
		await expect(page.getByRole("link", { name: "Accessibility Test Tenancy" })).toBeVisible();
		await expect(page.getByRole("status")).toContainText(/1 result/);
		await expectNoA11yViolations(page, "corporate obligation filters");

		const help = page.getByRole("button", { name: "How this works" });
		await help.focus();
		await page.keyboard.press("Enter");
		await expect(page.getByRole("heading", { name: "Obligations register" })).toBeVisible();
		await expectNoA11yViolations(page, "corporate contextual help");
		await page.keyboard.press("Escape");
	});

	test("Corporate obligation form and detail are axe-clean", async ({ page }) => {
		await signIn(page);
		await page.goto("/admin/corporate/obligations/new");
		await expect(page.getByRole("heading", { name: "New obligation" })).toBeVisible();
		await expect(page.getByRole("checkbox", { name: "Recurring" })).toBeVisible();
		await expect(page.getByRole("checkbox", { name: "Contract required" })).toBeVisible();
		await expectNoA11yViolations(page, "corporate new obligation form");

		const obligationId = await withDb(async (client) => {
			const result = await client.query<{ id: string }>(`SELECT id FROM "AdministrativeObligation" WHERE code = 'ADM-A11Y-001' LIMIT 1`);
			return result.rows[0]!.id;
		});
		await page.goto(`/admin/corporate/obligations/${obligationId}`);
		await expect(page.getByRole("heading", { name: "Accessibility Test Tenancy" })).toBeVisible();
		await expect(page.getByRole("list", { name: "Workflow progress" })).toBeVisible();
		await expectNoA11yViolations(page, "corporate obligation detail");
	});

	test("Corporate mobile due-item overlay is keyboard-operable and axe-clean", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await signIn(page);
		const obligationId = await withDb(async (client) => {
			const result = await client.query<{ id: string }>(`SELECT id FROM "AdministrativeObligation" WHERE code = 'ADM-A11Y-001' LIMIT 1`);
			return result.rows[0]!.id;
		});
		await page.goto(`/admin/corporate/obligations/${obligationId}`);
		const update = page.getByRole("button", { name: "Update invoice / due" });
		await update.focus();
		await page.keyboard.press("Enter");
		await expect(page.getByRole("heading", { name: "Update due item" })).toBeVisible();
		await expectNoA11yViolations(page, "corporate mobile due overlay");
		await page.keyboard.press("Escape");
		await expect(page.getByRole("heading", { name: "Update due item" })).toBeHidden();
	});
});

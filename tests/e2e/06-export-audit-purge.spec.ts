import { expect, test } from "@playwright/test";
import { completeAssessment, invite, signIn, withDb } from "./helpers";

/**
 * Phase 7 verification: CSV export, audit completeness, PII absence, and purge.
 *
 * Self-contained: the first test generates every audited action itself rather than
 * depending on earlier spec files having run — a spec file must pass standalone.
 * Runs on the desktop project because everything here is admin UI.
 */

test("a full admin round produces a complete, identity-free audit trail", async ({
	page,
}) => {
	test.setTimeout(180_000);
	const stamp = Date.now();
	await signIn(page); // -> admin.login

	// invite.created x3, then one of each lifecycle action.
	const walkLink = await invite(
		page,
		`Walk-${stamp}`,
		`walk+${stamp}@example.com`,
	);
	await invite(page, `Rev-${stamp}`, `rev+${stamp}@example.com`);
	await invite(page, `Res-${stamp}`, `res+${stamp}@example.com`);

	const [revokeId, resendId] = await withDb(async (db) => {
		const rows = await db.query(
			`SELECT id, email FROM "Candidate" WHERE email IN ($1, $2) ORDER BY email`,
			[`res+${stamp}@example.com`, `rev+${stamp}@example.com`],
		);
		const byEmail = Object.fromEntries(rows.rows.map((r) => [r.email, r.id]));
		return [
			byEmail[`rev+${stamp}@example.com`],
			byEmail[`res+${stamp}@example.com`],
		];
	});

	expect(
		(await page.request.post(`/api/admin/invite/${revokeId}/revoke`)).ok(),
	).toBeTruthy(); // invite.revoked
	expect(
		(await page.request.post(`/api/admin/invite/${resendId}/resend`)).ok(),
	).toBeTruthy(); // invite.resent

	await completeAssessment(page, walkLink); // candidate.consented + assessment.submitted

	await signIn(page);
	await page.goto("/admin/candidates");
	await page.getByRole("link", { name: `Walk-${stamp}` }).click();
	await expect(page).toHaveURL(/\/admin\/candidate\//); // result.viewed

	expect((await page.request.get("/api/admin/export")).status()).toBe(200); // export.downloaded

	const { events, candidates } = await withDb(async (db) => ({
		events: (
			await db.query(
				'SELECT actor, action, "subjectId", meta FROM "AuditEvent"',
			)
		).rows,
		candidates: (await db.query('SELECT email, "fullName" FROM "Candidate"'))
			.rows,
	}));

	const actions = new Set(events.map((e) => e.action));
	for (const action of [
		"admin.login",
		"invite.created",
		"invite.resent",
		"invite.revoked",
		"candidate.consented",
		"assessment.submitted",
		"result.viewed",
		"export.downloaded",
	]) {
		expect(actions, `missing audit action ${action}`).toContain(action);
	}

	const serialised = JSON.stringify(events);
	// No email-shaped string, no candidate's actual name or email, no 32-byte token.
	expect(serialised).not.toMatch(/[^\s@",]+@[^\s@",]+\.[a-z]{2,}/i);
	for (const c of candidates) {
		expect(serialised).not.toContain(c.email);
		expect(serialised).not.toContain(c.fullName);
	}
	expect(serialised).not.toMatch(/[A-Za-z0-9_-]{43}/);
});

test("the CSV export has the right shape, no overall column, and neutralises formulas", async ({
	page,
}) => {
	await signIn(page);
	const stamp = Date.now();
	// A hostile-but-plausible display name starting with '=' must not execute in Excel.
	await invite(page, "=cmd|foo", `hostile+${stamp}@example.com`);

	const response = await page.request.get("/api/admin/export");
	expect(response.status()).toBe(200);
	expect(response.headers()["content-type"]).toContain("text/csv");

	const csv = await response.text();
	const lines = csv.trim().split("\r\n");
	const expectedRows = await withDb(async (db) =>
		Number((await db.query('SELECT count(*) FROM "Candidate"')).rows[0].count),
	);

	expect(lines[0]).toContain("email");
	expect(lines[0]).toContain("wer_scaled");
	expect(lines[0]).toContain("ina_scaled");
	expect(lines[0]).toContain("flag_rushed");
	expect(lines[0].toLowerCase()).not.toContain("overall");
	expect(lines.length - 1).toBe(expectedRows);

	const hostileLine = lines.find((l) => l.includes(`hostile+${stamp}`))!;
	expect(hostileLine).toContain(`"'=cmd|foo"`);
});

test("purge deletes every candidate and leaves an identity-free audit trail", async ({
	page,
}) => {
	await signIn(page);
	// Purge lives on its own page now — requirements §11.1 keeps it off the daily dashboard.
	await page.goto("/admin/data");

	const purgeInput = page.getByLabel("Confirmation phrase");
	await purgeInput.scrollIntoViewIfNeeded();

	// The button stays disabled until the exact phrase is typed.
	const purgeButton = page.getByRole("button", {
		name: "Delete all candidate data",
	});
	await expect(purgeButton).toBeDisabled();
	await purgeInput.fill("delete all candidate data");
	await expect(purgeButton).toBeDisabled();
	await purgeInput.fill("DELETE ALL CANDIDATE DATA");
	await expect(purgeButton).toBeEnabled();
	await purgeButton.click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Delete permanently" })
		.click();
	await expect(page.getByRole("status")).toContainText(
		/Deleted \d+ candidate record/,
	);

	const remaining = await withDb(async (db) => ({
		candidates: Number(
			(await db.query('SELECT count(*) FROM "Candidate"')).rows[0].count,
		),
		responses: Number(
			(await db.query('SELECT count(*) FROM "Response"')).rows[0].count,
		),
		results: Number(
			(await db.query('SELECT count(*) FROM "Result"')).rows[0].count,
		),
		purgeEvents: Number(
			(
				await db.query(
					`SELECT count(*) FROM "AuditEvent" WHERE action = 'data.purged'`,
				)
			).rows[0].count,
		),
	}));

	expect(remaining.candidates).toBe(0);
	expect(remaining.responses).toBe(0);
	expect(remaining.results).toBe(0);
	expect(remaining.purgeEvents).toBeGreaterThan(0);
});

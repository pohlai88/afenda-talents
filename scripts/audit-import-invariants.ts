/**
 * Audit script: verify shared instrument invariants against in-repo fixtures
 * and optionally all Assessment/AssessmentVersion rows in the database.
 *
 * Exit codes:
 *   0 — all in-repo fixtures pass publish-mode invariants (live DB warnings don't block)
 *   1 — at least one in-repo fixture has hard invariant failures
 *
 * Usage:
 *   pnpm exec tsx scripts/audit-import-invariants.ts
 *   DATABASE_URL=... pnpm exec tsx scripts/audit-import-invariants.ts
 *
 * No PII in output — only ids/keys, never names or emails.
 */
import "dotenv/config";
import { CORE_V1_DOCUMENT } from "../src/lib/core-v1-document";
import { PRE_JOINING_2026_DOCUMENT } from "../src/lib/pre-joining-2026-document";
import { assertInstrumentInvariants } from "../src/lib/instrument-invariants";

const FIXTURES = [
	{ label: "core-v1", doc: CORE_V1_DOCUMENT as unknown },
	{ label: "pre-joining-2026", doc: PRE_JOINING_2026_DOCUMENT as unknown },
] as const;

let fixturesFailed = false;

// ---------------------------------------------------------------------------
// In-repo fixture checks (always run; fail process if any hard issue)
// ---------------------------------------------------------------------------
console.log("=== In-repo fixture checks (publish mode) ===");
for (const { label, doc } of FIXTURES) {
	const issues = assertInstrumentInvariants(doc, "publish");
	if (issues.length === 0) {
		console.log(`  PASS  ${label}`);
	} else {
		console.error(`  FAIL  ${label}`);
		for (const issue of issues) {
			console.error(`        [${issue.code}] ${issue.message}${issue.path ? ` (at ${issue.path})` : ""}`);
		}
		fixturesFailed = true;
	}
}

if (fixturesFailed) {
	console.error("\nFixture invariant failures — exit 1");
	process.exitCode = 1;
} else {
	console.log("\nAll fixtures clean.");
}

// ---------------------------------------------------------------------------
// Live database scan (optional — only when DATABASE_URL is set)
// ---------------------------------------------------------------------------
if (!process.env.DATABASE_URL) {
	console.log("\n(No DATABASE_URL — skipping live database scan)");
	process.exit(process.exitCode ?? 0);
}

// Lazy-import Prisma only when DATABASE_URL is present so the script works
// without a configured DB (fixtures-only path).
async function scanDatabase() {
	const { PrismaClient } = await import("../src/generated/prisma/client");
	const { PrismaPg } = await import("@prisma/adapter-pg");
	const { stabilizePgUrl } = await import("../src/lib/pg-url");

	const adapter = new PrismaPg({
		connectionString: stabilizePgUrl(process.env.DATABASE_URL!),
	});
	const db = new PrismaClient({ adapter });

	try {
		console.log("\n=== Live database scan ===");

		// Draft documents (draft mode) — fetch all and filter in-memory to avoid
		// JsonNullableFilter type complications across Prisma versions.
		const allAssessments = await db.assessment.findMany({
			select: { id: true, draftDocument: true },
		});
		const drafts = allAssessments.filter((r) => r.draftDocument !== null);
		let draftWarnings = 0;
		for (const row of drafts) {
			const issues = assertInstrumentInvariants(row.draftDocument, "draft");
			if (issues.length > 0) {
				console.warn(`  WARN  draft assessment id=${row.id}`);
				for (const issue of issues) {
					console.warn(`        [${issue.code}] ${issue.message}${issue.path ? ` (at ${issue.path})` : ""}`);
				}
				draftWarnings++;
			}
		}
		console.log(`  Scanned ${drafts.length} draft(s); ${draftWarnings} with warnings.`);

		// Published version documents (publish mode)
		const versions = await db.assessmentVersion.findMany({
			select: { id: true, document: true },
		});
		let publishWarnings = 0;
		for (const row of versions) {
			const issues = assertInstrumentInvariants(row.document, "publish");
			if (issues.length > 0) {
				console.warn(`  WARN  published version id=${row.id}`);
				for (const issue of issues) {
					console.warn(`        [${issue.code}] ${issue.message}${issue.path ? ` (at ${issue.path})` : ""}`);
				}
				publishWarnings++;
			}
		}
		console.log(
			`  Scanned ${versions.length} published version(s); ${publishWarnings} with warnings.`,
		);

		if (draftWarnings + publishWarnings > 0) {
			console.warn("\nLive database has invariant warnings (not failing — only fixtures must pass).");
		} else {
			console.log("\nAll live rows clean.");
		}
	} finally {
		await db.$disconnect();
	}
}

scanDatabase().catch((err) => {
	console.error("Database scan error:", err instanceof Error ? err.message : String(err));
	// Don't override fixture exit code — live DB errors are warnings only
});

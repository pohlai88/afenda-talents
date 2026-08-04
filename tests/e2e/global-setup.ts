import { Client } from "pg";
import { randomBytes } from "node:crypto";
import {
	CORE_V1_ASSESSMENT_KEY,
	CORE_V1_DOCUMENT,
} from "../../src/lib/core-v1-document";

/**
 * Runs once per test run, before the web server accepts traffic. Resets all mutable
 * state in the e2e database so runs are deterministic: previous runs' candidates,
 * rate-limit rows, and audit events do not leak into this one.
 *
 * Item rows are deliberately left alone. When the D18 Assessment/HiringRound tables
 * exist, an OPEN Core round is re-ensured so invites keep working.
 */
async function globalSetup(): Promise<void> {
	const client = new Client({ connectionString: process.env.DATABASE_URL });
	client.on("error", () => {});
	await client.connect();
	// Candidate cascades to Response, Result, and CandidateAssignment via onDelete.
	await client.query('DELETE FROM "Candidate"');
	await client.query('DELETE FROM "LoginAttempt"');
	await client.query('DELETE FROM "AuditEvent"');

	const tables = await client.query<{ exists: boolean }>(
		`SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'Assessment'
     ) AS exists`,
	);

	if (tables.rows[0]?.exists) {
		const assessment = await client.query<{ id: string }>(
			`SELECT id FROM "Assessment" WHERE key = $1 LIMIT 1`,
			[CORE_V1_ASSESSMENT_KEY],
		);
		let assessmentId = assessment.rows[0]?.id;
		if (!assessmentId) {
			assessmentId = `c${randomBytes(12).toString("hex")}`;
			await client.query(
				`INSERT INTO "Assessment" (id, key, title, kind, "isSystem", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'SYSTEM', true, 'PUBLISHED', NOW(), NOW())`,
				[assessmentId, CORE_V1_ASSESSMENT_KEY, CORE_V1_DOCUMENT.title],
			);
		}

		const version = await client.query<{ id: string }>(
			`SELECT id FROM "AssessmentVersion" WHERE "assessmentId" = $1 AND "versionNumber" = 1 LIMIT 1`,
			[assessmentId],
		);
		let versionId = version.rows[0]?.id;
		if (!versionId) {
			versionId = `c${randomBytes(12).toString("hex")}`;
			await client.query(
				`INSERT INTO "AssessmentVersion" (id, "assessmentId", "versionNumber", document, "publishedAt")
         VALUES ($1, $2, 1, $3::jsonb, NOW())`,
				[versionId, assessmentId, JSON.stringify(CORE_V1_DOCUMENT)],
			);
		}

		const round = await client.query<{ id: string; status: string }>(
			`SELECT id, status FROM "HiringRound" WHERE "assessmentVersionId" = $1 AND name = $2 LIMIT 1`,
			[versionId, "Initial hiring round"],
		);
		if (!round.rows[0]) {
			await client.query(
				`INSERT INTO "HiringRound" (id, name, status, "assessmentVersionId", "createdAt", "updatedAt")
         VALUES ($1, $2, 'OPEN', $3, NOW(), NOW())`,
				[
					`c${randomBytes(12).toString("hex")}`,
					"Initial hiring round",
					versionId,
				],
			);
		} else if (round.rows[0].status !== "OPEN") {
			await client.query(
				`UPDATE "HiringRound" SET status = 'OPEN' WHERE id = $1`,
				[round.rows[0].id],
			);
		}
	}

	await client.end();
}

export default globalSetup;

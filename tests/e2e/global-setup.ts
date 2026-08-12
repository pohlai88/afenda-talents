import { Client } from "pg";
import { randomBytes } from "node:crypto";
import {
	CORE_V1_ASSESSMENT_KEY,
	CORE_V1_DOCUMENT,
} from "../../src/lib/core-v1-document";
import { hashPassword } from "../../src/lib/passwords";

async function globalSetup(): Promise<void> {
	const client = new Client({ connectionString: process.env.DATABASE_URL });
	client.on("error", () => {});
	await client.connect();
	await client.query('DELETE FROM "Candidate"');
	await client.query('DELETE FROM "LoginAttempt"');
	await client.query('DELETE FROM "AuditEvent"');

	const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
	const adminPassword = process.env.ADMIN_PASSWORD;
	let adminUserId: string | null = null;
	if (adminEmail && adminPassword) {
		const passwordHash = hashPassword(adminPassword);
		await client.query(
			`INSERT INTO "User" (id, email, name, "passwordHash", role, "mustChangePassword", "createdAt")
       VALUES ($1, $2, 'Administrator', $3, 'ADMIN', false, NOW())
       ON CONFLICT (email) DO UPDATE SET
         "passwordHash" = EXCLUDED."passwordHash",
         role = 'ADMIN',
         "mustChangePassword" = false`,
			[`c${randomBytes(12).toString("hex")}`, adminEmail, passwordHash],
		);
		const admin = await client.query<{ id: string }>(
			`SELECT id FROM "User" WHERE email = $1 LIMIT 1`,
			[adminEmail],
		);
		adminUserId = admin.rows[0]?.id ?? null;
	}

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

	const corporateTables = await client.query<{ exists: boolean }>(
		`SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'AdministrativeCounterparty'
     ) AS exists`,
	);

	if (corporateTables.rows[0]?.exists) {
		await client.query('DELETE FROM "AdministrativePayment"');
		await client.query('DELETE FROM "ObligationDueItem"');
		await client.query('DELETE FROM "AdministrativeObligation"');
		await client.query('DELETE FROM "AdministrativeCounterparty"');
		await client.query('DELETE FROM "AdministrativeCustomFieldDefinition"');

		const counterpartyId = `c${randomBytes(12).toString("hex")}`;
		const obligationId = `c${randomBytes(12).toString("hex")}`;
		const dueItemId = `c${randomBytes(12).toString("hex")}`;
		const paymentId = `c${randomBytes(12).toString("hex")}`;

		await client.query(
			`INSERT INTO "AdministrativeCounterparty"
         (id, code, name, type, "defaultCurrency", "paymentTermsDays", "isActive", "customFields", "createdAt", "updatedAt")
       VALUES ($1, 'CP-A11Y-001', 'Accessible Properties Sdn Bhd', 'LANDLORD', 'MYR', 30, true, '{}'::jsonb, NOW(), NOW())`,
			[counterpartyId],
		);

		await client.query(
			`INSERT INTO "AdministrativeObligation"
         (id, code, organization, category, title, "counterpartyId", "ownerId", status,
          "startDate", recurring, "recurrenceInterval", "recurrenceUnit", "expectedAmount", currency,
          "firstDueDate", "nextDueDate", "contractRequired", "contractReference", "contractFileUrl",
          "customFields", "createdAt", "updatedAt")
       VALUES ($1, 'ADM-A11Y-001', 'DLBB', 'TENANCY', 'Accessibility Test Tenancy', $2, $3, 'ACTIVE',
          DATE '2026-01-01', true, 1, 'MONTH', 15000.00, 'MYR', DATE '2026-01-01', DATE '2026-09-01',
          true, 'TA-A11Y-001', 'https://example.com/contract.pdf', '{}'::jsonb, NOW(), NOW())`,
			[obligationId, counterpartyId, adminUserId],
		);

		await client.query(
			`INSERT INTO "ObligationDueItem"
         (id, "obligationId", "periodLabel", "dueDate", "expectedAmount", "invoiceAmount", currency,
          "invoiceRequired", "invoiceNumber", "invoiceFileUrl", status, "customFields", "createdAt", "updatedAt")
       VALUES ($1, $2, 'August 2026', DATE '2026-08-01', 15000.00, 15000.00, 'MYR', true,
          'INV-A11Y-0826', 'https://example.com/invoice.pdf', 'COMPLETED', '{}'::jsonb, NOW(), NOW())`,
			[dueItemId, obligationId],
		);

		await client.query(
			`INSERT INTO "AdministrativePayment"
         (id, "dueItemId", "requestDate", "requestedById", "requestedAmount", "approvalStatus", "approvedById",
          "approvalDate", "approvedAmount", "paymentStatus", "paymentDate", "paidAmount", "paymentMethod",
          "paymentReference", "paymentProofUrl", "customFields", "createdAt", "updatedAt")
       VALUES ($1, $2, NOW(), $3, 15000.00, 'APPROVED', $3, NOW(), 15000.00, 'PAID', NOW(), 15000.00,
          'BANK_TRANSFER', 'PAY-A11Y-001', 'https://example.com/payment.pdf', '{}'::jsonb, NOW(), NOW())`,
			[paymentId, dueItemId, adminUserId],
		);
	}

	await client.end();
}

export default globalSetup;

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
	CORE_V1_ASSESSMENT_KEY,
	CORE_V1_DOCUMENT,
} from "../src/lib/core-v1-document";
import {
	parseInstrumentDocument,
	type InstrumentDocument,
} from "../src/lib/instrument-document";
import { stabilizePgUrl } from "../src/lib/pg-url";
// Imported rather than read at runtime: a malformed or moved file then fails the
// build, not the seed. parseInstrumentDocument normalises the legacy
// `type: "likert"` items this document still carries.
import salesPerformanceRaw from "../data/Sales_Performance_Role_Positioning_Assessment.json";

const SALES_PERFORMANCE_ASSESSMENT_KEY = "sales-performance-role-positioning";

const adapter = new PrismaPg({
	connectionString: stabilizePgUrl(process.env.DATABASE_URL!),
});
const db = new PrismaClient({ adapter });

/**
 * Idempotent: an assessment shipped with the repository, its first published
 * version, and an OPEN round so it is selectable when inviting. Re-running the
 * seed never creates a second copy of any of the three.
 */
async function ensureSystemAssessment(
	key: string,
	doc: InstrumentDocument,
	roundName: string,
): Promise<void> {
	let assessment = await db.assessment.findUnique({ where: { key } });
	if (!assessment) {
		assessment = await db.assessment.create({
			data: {
				key,
				title: doc.title,
				kind: "SYSTEM",
				isSystem: true,
				status: "PUBLISHED",
			},
		});
	}

	let version = await db.assessmentVersion.findFirst({
		where: { assessmentId: assessment.id, versionNumber: 1 },
	});
	if (!version) {
		version = await db.assessmentVersion.create({
			data: { assessmentId: assessment.id, versionNumber: 1, document: doc },
		});
	}

	const round = await db.hiringRound.findFirst({
		where: { assessmentVersionId: version.id, name: roundName },
	});
	if (!round) {
		await db.hiringRound.create({
			data: { name: roundName, status: "OPEN", assessmentVersionId: version.id },
		});
	} else if (round.status !== "OPEN") {
		await db.hiringRound.update({
			where: { id: round.id },
			data: { status: "OPEN" },
		});
	}

	console.log(`Seeded "${doc.title}" (${key}) with an OPEN round "${roundName}".`);
}

async function main() {
	const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
	const adminPassword = process.env.ADMIN_PASSWORD;
	if (adminEmail && adminPassword) {
		const { hashPassword } = await import("../src/lib/passwords");
		const passwordHash = hashPassword(adminPassword);
		await db.user.upsert({
			where: { email: adminEmail },
			update: { role: "ADMIN", passwordHash },
			create: {
				email: adminEmail,
				name: "Administrator",
				passwordHash,
				role: "ADMIN",
			},
		});
		console.log(`Admin user ensured: ${adminEmail}`);
	}

	await ensureSystemAssessment(
		CORE_V1_ASSESSMENT_KEY,
		parseInstrumentDocument(CORE_V1_DOCUMENT),
		"Initial hiring round",
	);

	await ensureSystemAssessment(
		SALES_PERFORMANCE_ASSESSMENT_KEY,
		parseInstrumentDocument(salesPerformanceRaw),
		"Sales performance round",
	);

	// Corporate Administration ships 11+ models that nothing seeded, so every CA
	// screen rendered its empty state and could not be judged. Imported lazily so
	// the Talents seed does not pay for it when SEED_CORPORATE=0.
	if (process.env.SEED_CORPORATE !== "0") {
		const { seedCorporate } = await import("./seed-corporate");
		await seedCorporate(db);
	}
}

main()
	.then(() => db.$disconnect())
	.catch(async (error) => {
		console.error(error);
		await db.$disconnect();
		process.exit(1);
	});

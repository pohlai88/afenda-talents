import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
	CORE_V1_ASSESSMENT_KEY,
	CORE_V1_DOCUMENT,
} from "../src/lib/core-v1-document";
import { parseInstrumentDocument } from "../src/lib/instrument-document";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
	const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
	const adminPassword = process.env.ADMIN_PASSWORD;
	if (adminEmail && adminPassword) {
		const { hashPassword } = await import("../src/lib/passwords");
		await db.user.upsert({
			where: { email: adminEmail },
			update: { role: "ADMIN" },
			create: {
				email: adminEmail,
				name: "Administrator",
				passwordHash: hashPassword(adminPassword),
				role: "ADMIN",
			},
		});
		console.log(`Admin user ensured: ${adminEmail}`);
	}

	const doc = parseInstrumentDocument(CORE_V1_DOCUMENT);
	let assessment = await db.assessment.findUnique({
		where: { key: CORE_V1_ASSESSMENT_KEY },
	});
	if (!assessment) {
		assessment = await db.assessment.create({
			data: {
				key: CORE_V1_ASSESSMENT_KEY,
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
			data: {
				assessmentId: assessment.id,
				versionNumber: 1,
				document: doc,
			},
		});
	}

	let round = await db.hiringRound.findFirst({
		where: { assessmentVersionId: version.id, name: "Initial hiring round" },
	});
	if (!round) {
		round = await db.hiringRound.create({
			data: {
				name: "Initial hiring round",
				status: "OPEN",
				assessmentVersionId: version.id,
			},
		});
	} else if (round.status !== "OPEN") {
		await db.hiringRound.update({
			where: { id: round.id },
			data: { status: "OPEN" },
		});
	}

	console.log(`Seeded Core v1 assessment and OPEN hiring round.`);
}

main()
	.then(() => db.$disconnect())
	.catch(async (error) => {
		console.error(error);
		await db.$disconnect();
		process.exit(1);
	});

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import instrument from "../data/instrument.json";
import {
	CORE_V1_ASSESSMENT_KEY,
	CORE_V1_DOCUMENT,
} from "../src/lib/core-v1-document";
import { parseInstrumentDocument } from "../src/lib/instrument-document";

// The seed runs standalone via tsx, so it builds its own client rather than importing
// src/lib/db.ts (which pulls in the full env validation this script does not need).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

function cuidLike(): string {
	return `c${randomBytes(12).toString("hex")}`;
}

async function main() {
	// Bootstrap hiring user: the env credentials become the first ADMIN account.
	// Further users are created from the dashboard by an admin. Idempotent: the
	// password is only (re)set when the account is first created.
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

	// Upsert keyed on the stable item id is what makes re-running safe.
	for (const item of instrument.items) {
		await db.item.upsert({
			where: { id: item.id },
			update: {
				dimension: item.dimension,
				order: item.order,
				text: item.text,
				reverseScored: item.reverseScored,
				isValidity: item.isValidity,
			},
			create: item,
		});
	}
	const count = await db.item.count();
	console.log(`Seeded instrument. Item count: ${count}`);

	// D18: Core system assessment + one OPEN hiring round so invites work out of the box.
	const doc = parseInstrumentDocument(CORE_V1_DOCUMENT);
	let assessment = await db.assessment.findUnique({
		where: { key: CORE_V1_ASSESSMENT_KEY },
	});
	if (!assessment) {
		assessment = await db.assessment.create({
			data: {
				id: cuidLike(),
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
				id: cuidLike(),
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
				id: cuidLike(),
				name: "Initial hiring round",
				status: "OPEN",
				assessmentVersionId: version.id,
			},
		});
	} else if (round.status !== "OPEN") {
		round = await db.hiringRound.update({
			where: { id: round.id },
			data: { status: "OPEN" },
		});
	}
	console.log(`Hiring round ensured: ${round.name} (${round.status})`);
}

main()
	.then(() => db.$disconnect())
	.catch(async (error) => {
		console.error(error);
		await db.$disconnect();
		process.exit(1);
	});

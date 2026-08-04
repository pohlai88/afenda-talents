// @ts-nocheck — expand-era Candidate/Response columns are removed in contract schema.
/**
 * Transactional backfill after expand migration (D18).
 * One-shot against the expand schema. After contract migration this is a no-op.
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
	CORE_V1_ASSESSMENT_KEY,
	CORE_V1_DOCUMENT,
} from "../src/lib/core-v1-document";
import { parseInstrumentDocument } from "../src/lib/instrument-document";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

function cuidLike(): string {
	return `c${randomBytes(12).toString("hex")}`;
}

async function main() {
	const doc = parseInstrumentDocument(CORE_V1_DOCUMENT);

	const result = await db.$transaction(async (tx) => {
		let assessment = await tx.assessment.findUnique({
			where: { key: CORE_V1_ASSESSMENT_KEY },
		});
		if (!assessment) {
			assessment = await tx.assessment.create({
				data: {
					id: cuidLike(),
					key: CORE_V1_ASSESSMENT_KEY,
					title: doc.title,
					kind: "SYSTEM",
					isSystem: true,
					status: "PUBLISHED",
					draftDocument: Prisma.DbNull,
				},
			});
		}

		let version = await tx.assessmentVersion.findFirst({
			where: { assessmentId: assessment.id, versionNumber: 1 },
		});
		if (!version) {
			version = await tx.assessmentVersion.create({
				data: {
					id: cuidLike(),
					assessmentId: assessment.id,
					versionNumber: 1,
					document: doc,
				},
			});
		}

		let round = await tx.hiringRound.findFirst({
			where: { name: "Initial hiring round", assessmentVersionId: version.id },
		});
		if (!round) {
			round = await tx.hiringRound.create({
				data: {
					id: cuidLike(),
					name: "Initial hiring round",
					status: "OPEN",
					assessmentVersionId: version.id,
				},
			});
		}

		const candidates = await tx.candidate.findMany();
		let created = 0;
		let linkedResponses = 0;
		let linkedResults = 0;

		for (const c of candidates) {
			let assignment = await tx.candidateAssignment.findUnique({
				where: {
					candidateId_hiringRoundId: {
						candidateId: c.id,
						hiringRoundId: round.id,
					},
				},
			});
			if (!assignment) {
				assignment = await tx.candidateAssignment.create({
					data: {
						id: cuidLike(),
						candidateId: c.id,
						hiringRoundId: round.id,
						assessmentVersionId: version.id,
						status: c.status,
						invitedById: c.invitedById,
						tokenHash: c.tokenHash,
						expiresAt: c.expiresAt,
						sentAt: c.sentAt,
						openedAt: c.openedAt,
						consentedAt: c.consentedAt,
						startedAt: c.startedAt,
						submittedAt: c.submittedAt,
					},
				});
				created += 1;
			}

			const responses = await tx.response.findMany({
				where: { candidateId: c.id },
			});
			for (const r of responses) {
				if (r.assignmentId === assignment.id && r.questionId === r.itemId) continue;
				await tx.response.update({
					where: { id: r.id },
					data: {
						assignmentId: assignment.id,
						questionId: r.itemId,
					},
				});
				linkedResponses += 1;
			}

			const existingResult = await tx.result.findFirst({
				where: { candidateId: c.id },
			});
			if (existingResult && !existingResult.assignmentId) {
				await tx.result.update({
					where: { id: existingResult.id },
					data: {
						assignmentId: assignment.id,
						assessmentVersionId: version.id,
					},
				});
				linkedResults += 1;
			}
		}

		await tx.auditEvent.create({
			data: {
				actor: "system",
				action: "assessment.seeded",
				subjectId: assessment.id,
				meta: {
					versionId: version.id,
					roundId: round.id,
					assignmentsCreated: created,
				},
			},
		});

		return {
			assessmentId: assessment.id,
			versionId: version.id,
			roundId: round.id,
			candidates: candidates.length,
			assignmentsCreated: created,
			responsesLinked: linkedResponses,
			resultsLinked: linkedResults,
		};
	});

	// Parity checks
	const orphanResponses = await db.response.count({
		where: { assignmentId: null },
	});
	const orphanResults = await db.result.count({
		where: { assignmentId: null },
	});
	const candidates = await db.candidate.count();
	const assignments = await db.candidateAssignment.count();

	console.log(JSON.stringify({ backfill: result, orphanResponses, orphanResults, candidates, assignments }, null, 2));

	if (orphanResponses > 0 || orphanResults > 0) {
		throw new Error("Parity failed: orphan responses or results remain");
	}
	if (assignments < candidates) {
		throw new Error("Parity failed: fewer assignments than candidates");
	}

	// Fingerprint document so operators can confirm Core v1
	const hash = createHash("sha256")
		.update(JSON.stringify(doc))
		.digest("hex")
		.slice(0, 16);
	console.log(`Core v1 document fingerprint: ${hash}`);
	console.log("Backfill OK.");
}

main()
	.then(() => db.$disconnect())
	.catch(async (error) => {
		console.error(error);
		await db.$disconnect();
		process.exit(1);
	});

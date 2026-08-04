import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin, requireHiringUser } from "@/lib/auth-admin";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const createSchema = z.object({
	name: z.string().min(1).max(200),
	assessmentVersionId: z.string().min(1),
});

export async function GET() {
	try {
		await requireHiringUser();
	} catch {
		return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
	}

	const rounds = await db.hiringRound.findMany({
		orderBy: { createdAt: "desc" },
		include: {
			assessmentVersion: {
				include: { assessment: { select: { id: true, title: true, kind: true } } },
			},
			_count: { select: { assignments: true } },
		},
	});

	return NextResponse.json({
		rounds: rounds.map((round) => ({
			id: round.id,
			name: round.name,
			status: round.status,
			createdAt: round.createdAt.toISOString(),
			assessmentVersionId: round.assessmentVersionId,
			assessmentTitle: round.assessmentVersion.assessment.title,
			assessmentVersionNumber: round.assessmentVersion.versionNumber,
			assignmentCount: round._count.assignments,
		})),
	});
}

export async function POST(request: Request) {
	let session;
	try {
		session = await requireAdmin();
	} catch {
		return NextResponse.json({ error: "Admin access required" }, { status: 403 });
	}

	const parsed = createSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Provide a name and an assessment version" },
			{ status: 400 },
		);
	}

	const version = await db.assessmentVersion.findUnique({
		where: { id: parsed.data.assessmentVersionId },
		select: { id: true, assessmentId: true },
	});
	if (!version) {
		return NextResponse.json({ error: "Assessment version not found" }, { status: 404 });
	}

	const round = await db.hiringRound.create({
		data: {
			name: parsed.data.name.trim(),
			assessmentVersionId: version.id,
		},
	});

	await audit(session.userId, "round.created", round.id, {
		assessmentId: version.assessmentId,
		assessmentVersionId: version.id,
	});

	return NextResponse.json({ round: { id: round.id, name: round.name, status: round.status } });
}

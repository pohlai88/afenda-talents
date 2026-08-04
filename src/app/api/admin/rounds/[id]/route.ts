import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { assertRoundTransition, IllegalRoundTransition, ROUND_STATUSES, type RoundStatus } from "@/lib/status";

export const runtime = "nodejs";

const patchSchema = z
	.object({
		name: z.string().min(1).max(200).optional(),
		assessmentVersionId: z.string().min(1).optional(),
		status: z.enum(ROUND_STATUSES).optional(),
	})
	.refine((body) => body.name !== undefined || body.assessmentVersionId !== undefined || body.status !== undefined, {
		message: "Provide at least one field to update",
	});

const STATUS_AUDIT_ACTION = {
	OPEN: "round.opened",
	CLOSED: "round.closed",
	ARCHIVED: "round.archived",
} as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	let session;
	try {
		session = await requireAdmin();
	} catch {
		return NextResponse.json({ error: "Admin access required" }, { status: 403 });
	}

	const { id } = await params;
	const parsed = patchSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}

	const round = await db.hiringRound.findUnique({ where: { id } });
	if (!round) return NextResponse.json({ error: "Hiring round not found" }, { status: 404 });

	const { name, assessmentVersionId, status } = parsed.data;
	const data: { name?: string; assessmentVersionId?: string; status?: RoundStatus } = {};

	// Rename and version reassignment are DRAFT-only (design §4 round lifecycle table):
	// the version locks the moment the round opens.
	if (name !== undefined || assessmentVersionId !== undefined) {
		if (round.status !== "DRAFT") {
			return NextResponse.json(
				{ error: "Only a draft round's name or assessment version can be changed" },
				{ status: 409 },
			);
		}
		if (name !== undefined) data.name = name.trim();
		if (assessmentVersionId !== undefined) {
			const version = await db.assessmentVersion.findUnique({
				where: { id: assessmentVersionId },
				select: { id: true },
			});
			if (!version) {
				return NextResponse.json({ error: "Assessment version not found" }, { status: 404 });
			}
			data.assessmentVersionId = assessmentVersionId;
		}
	}

	if (status !== undefined) {
		try {
			assertRoundTransition(round.status as RoundStatus, status);
		} catch (error) {
			if (error instanceof IllegalRoundTransition) {
				return NextResponse.json({ error: error.message }, { status: 409 });
			}
			throw error;
		}
		data.status = status;
	}

	const updated = await db.hiringRound.update({ where: { id }, data });

	if (status !== undefined) {
		const action = STATUS_AUDIT_ACTION[status as keyof typeof STATUS_AUDIT_ACTION];
		if (action) {
			await audit(session.userId, action, round.id, {
				assessmentVersionId: updated.assessmentVersionId,
			});
		}
	}

	return NextResponse.json({
		round: { id: updated.id, name: updated.name, status: updated.status },
	});
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { applyStatus } from "@/lib/status";
import { expiryFromNow, generateToken, hashToken, inviteUrl } from "@/lib/tokens";
import { sendInvitation } from "@/lib/email";

export const runtime = "nodejs";

const bodySchema = z.object({
	hiringRoundId: z.string().min(1),
	candidates: z
		.array(z.object({ fullName: z.string().min(1).max(120), email: z.email() }))
		.min(1)
		.max(200),
});

export async function POST(request: Request) {
	let session;
	try {
		session = await requireAdmin();
	} catch {
		return NextResponse.json({ error: "Admin access required" }, { status: 403 });
	}

	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Provide a hiring round and a name and valid email for each candidate" },
			{ status: 400 },
		);
	}

	const round = await db.hiringRound.findUnique({
		where: { id: parsed.data.hiringRoundId },
		include: { assessmentVersion: true },
	});
	if (!round) {
		return NextResponse.json({ error: "Hiring round not found" }, { status: 404 });
	}
	if (round.status !== "OPEN") {
		return NextResponse.json(
			{ error: "Invitations require an open hiring round" },
			{ status: 400 },
		);
	}

	let invited = 0;
	let skipped = 0;

	for (const entry of parsed.data.candidates) {
		const email = entry.email.trim().toLowerCase();

		let candidate = await db.candidate.findUnique({ where: { email } });
		if (!candidate) {
			candidate = await db.candidate.create({
				data: {
					email,
					fullName: entry.fullName.trim(),
				},
			});
		}

		const existingAssignment = await db.candidateAssignment.findUnique({
			where: {
				candidateId_hiringRoundId: {
					candidateId: candidate.id,
					hiringRoundId: round.id,
				},
			},
		});
		if (existingAssignment) {
			skipped++;
			continue;
		}

		const token = generateToken();
		const expiresAt = expiryFromNow(env.INVITE_TTL_DAYS);

		const assignment = await db.candidateAssignment.create({
			data: {
				candidateId: candidate.id,
				hiringRoundId: round.id,
				assessmentVersionId: round.assessmentVersionId,
				invitedById: session.userId,
				tokenHash: hashToken(token),
				expiresAt,
			},
		});

		await applyStatus(assignment.id, "SENT", { sentAt: new Date() });
		await sendInvitation(
			email,
			candidate.fullName,
			inviteUrl(env.APP_URL, token),
			expiresAt,
		);
		await audit(session.userId, "invite.created", assignment.id, {
			roundId: round.id,
			versionId: round.assessmentVersionId,
		});
		invited++;
	}

	return NextResponse.json({ invited, skipped });
}

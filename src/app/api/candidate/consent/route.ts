import { NextResponse } from "next/server";
import { requireAssignment } from "@/lib/auth-candidate";
import { applyStatus } from "@/lib/status";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
	let assignment;
	try {
		assignment = await requireAssignment();
	} catch {
		return NextResponse.json({ error: "Assessment is not available" }, { status: 403 });
	}

	const now = new Date();
	await applyStatus(assignment.id, "STARTED", { consentedAt: now, startedAt: now });
	await audit("candidate", "candidate.consented", assignment.id);

	return NextResponse.json({ ok: true });
}

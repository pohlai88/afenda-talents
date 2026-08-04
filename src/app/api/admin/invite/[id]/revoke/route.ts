import { NextResponse } from "next/server";
import { requireAdmin, type HiringSession } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { applyStatus, canTransition, type Status } from "@/lib/status";

export const runtime = "nodejs";

/**
 * `id` is the CandidateAssignment id (D18) — the invite/completion unit, not the
 * candidate. Token and status live on the assignment.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session: HiringSession;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const assignment = await db.candidateAssignment.findUnique({ where: { id } });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canTransition(assignment.status as Status, "REVOKED")) {
    return NextResponse.json(
      { error: `Cannot revoke from status ${assignment.status}` },
      { status: 409 },
    );
  }

  await applyStatus(id, "REVOKED");
  await db.candidateAssignment.update({ where: { id }, data: { tokenHash: null } });
  await audit(session.userId, "invite.revoked", assignment.id);

  return NextResponse.json({ ok: true });
}

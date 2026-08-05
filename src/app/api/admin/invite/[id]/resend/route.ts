import { NextResponse } from "next/server";
import { requireAdmin, type HiringSession } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { applyStatus } from "@/lib/status";
import { canTransition } from "@/lib/status-constants";
import { expiryFromNow, generateToken, hashToken, inviteUrl } from "@/lib/tokens";
import { sendInvitation } from "@/lib/email";

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
  const assignment = await db.candidateAssignment.findUnique({
    where: { id },
    include: { candidate: true },
  });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const from = assignment.status;
  // From SENT this is a fresh token with no status change (the table has no SENT -> SENT
  // edge, and calling applyStatus there would rightly throw). From EXPIRED or REVOKED it
  // is the table's resend edge. Anything else cannot be resent.
  if (from !== "SENT" && !canTransition(from, "SENT")) {
    return NextResponse.json({ error: `Cannot resend from status ${from}` }, { status: 409 });
  }

  const token = generateToken();
  const expiresAt = expiryFromNow(env.INVITE_TTL_DAYS);

  // Storing the new hash invalidates the previous link immediately.
  await db.candidateAssignment.update({
    where: { id },
    data: { tokenHash: hashToken(token), expiresAt, sentAt: new Date(), openedAt: null },
  });
  if (from !== "SENT") await applyStatus(id, "SENT");

  await sendInvitation(
    assignment.candidate.email,
    assignment.candidate.fullName,
    inviteUrl(env.APP_URL, token),
    expiresAt,
  );
  await audit(session.userId, "invite.resent", assignment.id);

  return NextResponse.json({ ok: true });
}

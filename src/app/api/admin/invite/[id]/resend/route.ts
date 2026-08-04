import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { applyStatus, canTransition, type Status } from "@/lib/status";
import { expiryFromNow, generateToken, hashToken, inviteUrl } from "@/lib/tokens";
import { sendInvitation } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const from = candidate.status as Status;
  // From SENT this is a fresh token with no status change (the table has no SENT -> SENT
  // edge, and calling applyStatus there would rightly throw). From EXPIRED or REVOKED it
  // is the table's resend edge. Anything else cannot be resent.
  if (from !== "SENT" && !canTransition(from, "SENT")) {
    return NextResponse.json({ error: `Cannot resend from status ${from}` }, { status: 409 });
  }

  const token = generateToken();
  const expiresAt = expiryFromNow(env.INVITE_TTL_DAYS);

  // Storing the new hash invalidates the previous link immediately.
  await db.candidate.update({
    where: { id },
    data: { tokenHash: hashToken(token), expiresAt, sentAt: new Date(), openedAt: null },
  });
  if (from !== "SENT") await applyStatus(id, "SENT");

  await sendInvitation(candidate.email, candidate.fullName, inviteUrl(env.APP_URL, token), expiresAt);
  await audit(session.userId, "invite.resent", id);

  return NextResponse.json({ ok: true });
}

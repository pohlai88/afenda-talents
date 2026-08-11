import { NextResponse } from "next/server";
import { requireAdmin, type HiringSession } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { applyStatus } from "@/lib/status";
import { canTransition } from "@/lib/status-constants";
import {
  expiryFromNow,
  generateToken,
  hashToken,
  inviteUrl,
} from "@/lib/tokens";
import { sendInvitation } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  if (!assignment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const from = assignment.status;
  if (from !== "SENT" && !canTransition(from, "SENT")) {
    return NextResponse.json(
      { error: `Cannot resend from status ${from}` },
      { status: 409 },
    );
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = expiryFromNow(env.INVITE_TTL_DAYS);

  try {
    await db.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT "status"::text AS "status"
          FROM "CandidateAssignment"
          WHERE "id" = ${id}
          FOR UPDATE
        `;
        const currentStatus = locked[0]?.status;
        if (currentStatus !== from) {
          throw new Error("Invitation changed before resend");
        }

        await tx.candidateAssignment.update({
          where: { id },
          data: {
            tokenHash,
            expiresAt,
            sentAt: new Date(),
            openedAt: null,
          },
        });
        await sendInvitation(
          assignment.candidate.email,
          assignment.candidate.fullName,
          inviteUrl(env.APP_URL, token),
          expiresAt,
          `candidate-resend/${id}/${tokenHash.slice(0, 24)}`,
        );
        if (from !== "SENT") {
          await applyStatus(id, "SENT", {}, tx);
        }
        await audit(session.userId, "invite.resent", id, undefined, tx);
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    console.error("Invitation resend failed", {
      assignmentId: id,
      error: error instanceof Error ? error.message : "Unknown delivery error",
    });
    return NextResponse.json(
      { error: "The replacement invitation was not sent. The current link remains unchanged." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

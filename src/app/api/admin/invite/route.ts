import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { applyStatus } from "@/lib/status";
import {
  expiryFromNow,
  generateToken,
  hashToken,
  inviteUrl,
} from "@/lib/tokens";
import { sendInvitation } from "@/lib/email";

export const runtime = "nodejs";

const bodySchema = z.object({
  hiringRoundId: z.string().min(1),
  candidates: z
    .array(
      z.object({
        fullName: z.string().min(1).max(120),
        email: z.email(),
      }),
    )
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
    select: { id: true, status: true, assessmentVersionId: true },
  });
  if (!round) {
    return NextResponse.json({ error: "Hiring round not found" }, { status: 404 });
  }
  if (round.status !== "OPEN") {
    return NextResponse.json(
      { error: "Invitations require an open hiring round" },
      { status: 409 },
    );
  }

  let invited = 0;
  let skipped = 0;
  const failures: Array<{ fullName: string; email: string }> = [];

  for (const entry of parsed.data.candidates) {
    const email = entry.email.trim().toLowerCase();
    const fullName = entry.fullName.trim();

    try {
      const outcome = await db.$transaction(
        async (tx) => {
          const currentRound = await tx.hiringRound.findUnique({
            where: { id: round.id },
            select: { status: true, assessmentVersionId: true },
          });
          if (!currentRound || currentRound.status !== "OPEN") {
            throw new Error("Hiring round is no longer open");
          }

          const candidate = await tx.candidate.upsert({
            where: { email },
            update: {},
            create: { email, fullName },
          });
          const existing = await tx.candidateAssignment.findUnique({
            where: {
              candidateId_hiringRoundId: {
                candidateId: candidate.id,
                hiringRoundId: round.id,
              },
            },
          });
          if (existing && existing.status !== "DRAFT") {
            return "skipped" as const;
          }

          const token = generateToken();
          const tokenHash = hashToken(token);
          const expiresAt = expiryFromNow(env.INVITE_TTL_DAYS);
          const assignment = existing
            ? await tx.candidateAssignment.update({
                where: { id: existing.id },
                data: {
                  assessmentVersionId: currentRound.assessmentVersionId,
                  invitedById: session.userId,
                  tokenHash,
                  expiresAt,
                },
              })
            : await tx.candidateAssignment.create({
                data: {
                  candidateId: candidate.id,
                  hiringRoundId: round.id,
                  assessmentVersionId: currentRound.assessmentVersionId,
                  invitedById: session.userId,
                  tokenHash,
                  expiresAt,
                },
              });

          await sendInvitation(
            email,
            candidate.fullName,
            inviteUrl(env.APP_URL, token),
            expiresAt,
            `candidate-invitation/${assignment.id}/${tokenHash.slice(0, 24)}`,
          );
          await applyStatus(
            assignment.id,
            "SENT",
            { sentAt: new Date() },
            tx,
          );
          await audit(
            session.userId,
            "invite.created",
            assignment.id,
            {
              roundId: round.id,
              versionId: currentRound.assessmentVersionId,
            },
            tx,
          );
          return "invited" as const;
        },
        { timeout: 15_000 },
      );

      if (outcome === "invited") invited += 1;
      else skipped += 1;
    } catch (error) {
      failures.push({ fullName, email });
      console.error("Candidate invitation delivery failed", {
        roundId: round.id,
        error: error instanceof Error ? error.message : "Unknown delivery error",
      });
    }
  }

  return NextResponse.json({
    invited,
    skipped,
    failed: failures.length,
    failures,
  });
}

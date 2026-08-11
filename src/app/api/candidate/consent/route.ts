import { NextResponse } from "next/server";
import { requireAssignment } from "@/lib/auth-candidate";
import { db } from "@/lib/db";
import {
  applyStatus,
  ConcurrentStatusTransition,
} from "@/lib/status";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
  let assignment;
  try {
    assignment = await requireAssignment();
  } catch {
    return NextResponse.json(
      { error: "Assessment is not available" },
      { status: 403 },
    );
  }

  const now = new Date();
  try {
    await db.$transaction(async (tx) => {
      const current = await tx.candidateAssignment.findUnique({
        where: { id: assignment.id },
        select: { status: true },
      });
      if (!current) throw new Error("Assignment not found");
      if (current.status === "STARTED") return;
      if (current.status !== "SENT") throw new Error("Assignment cannot be started");

      await applyStatus(
        assignment.id,
        "STARTED",
        { consentedAt: now, startedAt: now },
        tx,
      );
      await audit(
        "candidate",
        "candidate.consented",
        assignment.id,
        undefined,
        tx,
      );
    });
  } catch (error) {
    if (error instanceof ConcurrentStatusTransition) {
      const current = await db.candidateAssignment.findUnique({
        where: { id: assignment.id },
        select: { status: true },
      });
      if (current?.status === "STARTED") {
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json(
      { error: "Could not start the assessment" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}

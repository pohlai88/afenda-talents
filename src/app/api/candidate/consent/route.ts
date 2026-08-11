import { NextResponse } from "next/server";
import {
  currentAssignmentId,
  requireAssignment,
  resolveAssignmentToken,
} from "@/lib/auth-candidate";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { orderedAnswerableItems } from "@/lib/instrument-document";
import { loadVersionDocument } from "@/lib/version-document";
import {
  applyStatus,
  ConcurrentStatusTransition,
} from "@/lib/status";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Invitation reference required" }, { status: 400 });
  }

  const [assignment, cookieAssignmentId] = await Promise.all([
    resolveAssignmentToken(token),
    currentAssignmentId(),
  ]);
  if (!assignment) {
    return NextResponse.json(
      { error: "Assessment is not available", action: "done" },
      { status: 403 },
    );
  }
  if (cookieAssignmentId !== assignment.id) {
    return NextResponse.json(
      { error: "Candidate session needs to be refreshed", action: "reenter" },
      { status: 409 },
    );
  }
  if (assignment.status === "STARTED") {
    return NextResponse.json(
      { error: "Assessment already started", action: "assessment" },
      { status: 409 },
    );
  }

  const doc = await loadVersionDocument(assignment.assessmentVersionId);
  const itemCount = orderedAnswerableItems(doc).length;
  const retention = doc.consent.retention.replace(
    "{RETENTION_DAYS}",
    String(env.RETENTION_DAYS),
  );

  return NextResponse.json({
    fullName: assignment.candidate.fullName,
    candidateIntroduction: doc.candidateIntroduction,
    estimatedMinutes: doc.estimatedMinutes,
    itemCount,
    consent: {
      purpose: doc.consent.purpose,
      whatWeCollect: doc.consent.whatWeCollect,
      whoSeesIt: doc.consent.whoSeesIt,
      retention,
    },
  });
}

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

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  CANDIDATE_COOKIE,
  candidateCookieOptions,
  currentAssignmentId,
} from "@/lib/auth-candidate";
import { applyStatus } from "@/lib/status";
import { audit } from "@/lib/audit";
import { scoreAssessment } from "@/lib/scoring";
import { sendReceipt } from "@/lib/email";
import { loadVersionDocument } from "@/lib/version-document";
import { orderedAnswerableItems } from "@/lib/instrument-document";

export const runtime = "nodejs";

class SubmissionValidationError extends Error {
  constructor(readonly unanswered: string[]) {
    super("Required answers are missing");
    this.name = "SubmissionValidationError";
  }
}

class SubmissionStateError extends Error {}

export async function POST() {
  const assignmentId = await currentAssignmentId();
  if (!assignmentId) {
    return NextResponse.json(
      { error: "Assessment is not available" },
      { status: 403 },
    );
  }

  const assignment = await db.candidateAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      candidate: { select: { email: true, fullName: true } },
    },
  });
  if (!assignment) {
    return NextResponse.json(
      { error: "Assessment is not available" },
      { status: 403 },
    );
  }
  if (
    assignment.status === "STARTED" &&
    assignment.expiresAt &&
    assignment.expiresAt.getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: "Assessment is not available" },
      { status: 403 },
    );
  }
  if (assignment.status !== "STARTED" && assignment.status !== "SCORED") {
    return NextResponse.json(
      { error: "Assessment cannot be submitted from its current state" },
      { status: 409 },
    );
  }

  const document = await loadVersionDocument(assignment.assessmentVersionId);
  const answerable = orderedAnswerableItems(document);

  let sendCompletionReceipt = false;
  try {
    sendCompletionReceipt = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT "status"::text AS "status"
        FROM "CandidateAssignment"
        WHERE "id" = ${assignmentId}
        FOR UPDATE
      `;
      const currentStatus = locked[0]?.status;
      if (!currentStatus) throw new SubmissionStateError("Assignment not found");
      if (currentStatus === "SCORED") return false;
      if (currentStatus !== "STARTED") {
        throw new SubmissionStateError("Assignment is no longer writable");
      }

      const responses = await tx.response.findMany({
        where: { assignmentId },
      });
      const byQuestion = new Map(
        responses.map((response) => [response.questionId, response]),
      );

      const unanswered: string[] = [];
      for (const item of answerable) {
        const row = byQuestion.get(item.id);
        if (item.type === "likert") {
          if (!row || row.value == null) unanswered.push(item.id);
        } else if (item.type === "short_text" || item.type === "long_text") {
          if (item.required && (!row || !row.textValue?.trim())) {
            unanswered.push(item.id);
          }
        }
      }
      if (unanswered.length > 0) {
        throw new SubmissionValidationError(unanswered);
      }

      const likertResponses = answerable
        .filter((item) => item.type === "likert")
        .map((item) => {
          const response = byQuestion.get(item.id)!;
          return {
            itemId: item.id,
            value: response.value!,
            msOnItem: response.msOnItem,
          };
        });
      const scored = scoreAssessment({
        versionDocument: document,
        responses: likertResponses,
      });

      const stamps = responses.map((response) => response.updatedAt.getTime());
      const serverWindowSeconds =
        stamps.length > 0
          ? Math.round((Math.max(...stamps) - Math.min(...stamps)) / 1000)
          : 0;

      await applyStatus(
        assignmentId,
        "SUBMITTED",
        { submittedAt: new Date() },
        tx,
      );
      await tx.result.upsert({
        where: { assignmentId },
        update: {
          dimensionScores: scored.dimensions,
          validityFlags: scored.responseContext,
          totalSeconds: scored.totalSeconds,
          serverWindowSeconds,
          assessmentVersionId: assignment.assessmentVersionId,
        },
        create: {
          assignmentId,
          assessmentVersionId: assignment.assessmentVersionId,
          dimensionScores: scored.dimensions,
          validityFlags: scored.responseContext,
          totalSeconds: scored.totalSeconds,
          serverWindowSeconds,
        },
      });
      await applyStatus(assignmentId, "SCORED", {}, tx);
      await audit(
        "candidate",
        "assessment.submitted",
        assignmentId,
        {
          itemCount: answerable.length,
          totalSeconds: scored.totalSeconds,
          versionId: assignment.assessmentVersionId,
        },
        tx,
      );
      return true;
    });
  } catch (error) {
    if (error instanceof SubmissionValidationError) {
      return NextResponse.json(
        {
          error: "Please answer every required item before submitting.",
          unanswered: error.unanswered,
        },
        { status: 400 },
      );
    }
    if (error instanceof SubmissionStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  if (sendCompletionReceipt) {
    try {
      await sendReceipt(
        assignment.candidate.email,
        assignment.candidate.fullName,
        `assessment-receipt/${assignmentId}`,
      );
    } catch (error) {
      console.error("Submission receipt delivery failed", {
        assignmentId,
        error: error instanceof Error ? error.message : "Unknown delivery error",
      });
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CANDIDATE_COOKIE, "", candidateCookieOptions(0));
  return response;
}

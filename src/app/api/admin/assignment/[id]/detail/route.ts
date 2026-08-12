import { NextResponse } from "next/server";
import { requireHiringUser } from "@/lib/auth-admin";
import { buildCandidateTimeline } from "@/lib/candidate-timeline";
import { db } from "@/lib/db";
import {
  normalizeContextFlags,
  normalizeDimensions,
} from "@/lib/result-display";
import { orderedAnswerableItems } from "@/lib/instrument-document";
import { loadVersionDocument } from "@/lib/version-document";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireHiringUser();
  } catch {
    return NextResponse.json({ error: "Hiring access required" }, { status: 403 });
  }

  const { id } = await params;
  const assignment = await db.candidateAssignment.findUnique({
    where: { id },
    include: {
      candidate: true,
      result: true,
      responses: true,
      hiringRound: { select: { id: true, name: true } },
      assessmentVersion: {
        select: {
          versionNumber: true,
          assessment: { select: { title: true } },
        },
      },
    },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Candidate assignment not found" }, { status: 404 });
  }

  const versionDoc = await loadVersionDocument(assignment.assessmentVersionId);
  const answerable = orderedAnswerableItems(versionDoc);
  const itemMeta = new Map(
    answerable.map((item, index) => {
      let dimension = "";
      if (item.type === "likert") {
        dimension = item.dimensionId
          ? (versionDoc.dimensions.find(
              (dimensionItem) => dimensionItem.id === item.dimensionId,
            )?.code ?? "VAL")
          : "VAL";
      }
      return [
        item.id,
        {
          order: index + 1,
          text: item.type === "info" ? "" : item.text,
          dimension,
        },
      ] as const;
    }),
  );

  const [inviter, auditRows] = await Promise.all([
    assignment.invitedById
      ? db.user.findUnique({
          where: { id: assignment.invitedById },
          select: { name: true },
        })
      : Promise.resolve(null),
    db.auditEvent.findMany({
      where: {
        subjectId: assignment.id,
        action: { in: ["invite.resent", "invite.revoked"] },
      },
      orderBy: { createdAt: "asc" },
      select: { action: true, createdAt: true },
    }),
  ]);

  const timeline = buildCandidateTimeline(
    {
      sentAt: assignment.sentAt,
      openedAt: assignment.openedAt,
      consentedAt: assignment.consentedAt,
      startedAt: assignment.startedAt,
      submittedAt: assignment.submittedAt,
      scoredAt: assignment.result?.computedAt ?? null,
    },
    auditRows,
  ).map((event) => ({
    ...event,
    at: event.at.toISOString(),
  }));

  const answerableIds = new Set(answerable.map((item) => item.id));
  const answeredCount = assignment.responses.filter((response) =>
    answerableIds.has(response.questionId),
  ).length;

  return NextResponse.json({
    isAdmin: session.role === "ADMIN",
    assignment: {
      id: assignment.id,
      status: assignment.status,
      hiringRoundId: assignment.hiringRoundId,
      hiringRoundName: assignment.hiringRound.name,
      assessmentTitle: assignment.assessmentVersion.assessment.title,
      versionNumber: assignment.assessmentVersion.versionNumber,
      sentAt: assignment.sentAt?.toISOString() ?? null,
      submittedAt: assignment.submittedAt?.toISOString() ?? null,
      inviterName: inviter?.name ?? null,
    },
    candidate: {
      id: assignment.candidate.id,
      fullName: assignment.candidate.fullName,
      email: assignment.candidate.email,
    },
    progress: {
      answeredCount,
      totalItems: answerable.length,
    },
    timeline,
    result: assignment.result
      ? {
          dimensions: normalizeDimensions(assignment.result.dimensionScores),
          flags: normalizeContextFlags(assignment.result.validityFlags),
          totalSeconds: assignment.result.totalSeconds,
          serverWindowSeconds: assignment.result.serverWindowSeconds,
          rows: assignment.responses
            .map((response) => {
              const meta = itemMeta.get(response.questionId);
              return {
                order: meta?.order ?? 0,
                text: meta?.text ?? response.questionId,
                value: response.value ?? response.textValue ?? "",
                dimension: meta?.dimension ?? "",
              };
            })
            .sort((left, right) => left.order - right.order),
        }
      : null,
  });
}

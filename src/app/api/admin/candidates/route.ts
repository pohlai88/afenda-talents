import { NextResponse } from "next/server";
import type { CandidateTableItem } from "@/components/candidates/types";
import { requireHiringUser } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { relativeTime } from "@/lib/relative-time";
import { resolveOperationalRound } from "@/lib/round-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let session;
  try {
    session = await requireHiringUser();
  } catch {
    return NextResponse.json({ error: "Hiring access required" }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedRoundId = url.searchParams.get("round");
  const { selected } = await resolveOperationalRound(requestedRoundId);
  const now = new Date();

  const assignments = selected
    ? await db.candidateAssignment.findMany({
        where: { hiringRoundId: selected.id },
        include: { candidate: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const [responseActivity, users] = await Promise.all([
    assignmentIds.length > 0
      ? db.response.groupBy({
          by: ["assignmentId"],
          where: { assignmentId: { in: assignmentIds } },
          _max: { updatedAt: true },
        })
      : Promise.resolve([]),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);

  const lastResponseAt = new Map(
    responseActivity.map((row) => [row.assignmentId, row._max.updatedAt]),
  );
  const userNames = new Map(users.map((user) => [user.id, user.name]));

  const items: CandidateTableItem[] = assignments.map((assignment) => {
    const lastActivityAt =
      [
        lastResponseAt.get(assignment.id) ?? null,
        assignment.submittedAt,
        assignment.openedAt,
        assignment.sentAt,
      ]
        .filter((date): date is Date => date instanceof Date)
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

    return {
      id: assignment.candidateId,
      assignmentId: assignment.id,
      fullName: assignment.candidate.fullName,
      email: assignment.candidate.email,
      status: assignment.status,
      sentAt: assignment.sentAt?.toISOString() ?? null,
      submittedAt: assignment.submittedAt?.toISOString() ?? null,
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
      lastActivityLabel: lastActivityAt ? relativeTime(lastActivityAt, now) : "—",
      invitedByName: assignment.invitedById
        ? (userNames.get(assignment.invitedById) ?? null)
        : null,
    };
  });

  const isAdmin = session.role === "ADMIN";
  const canInvite = isAdmin && selected?.status === "OPEN";

  return NextResponse.json({
    isAdmin,
    canInvite,
    selected: selected
      ? {
          id: selected.id,
          name: selected.name,
          status: selected.status,
          assessmentTitle: selected.assessmentTitle,
          versionNumber: selected.versionNumber,
        }
      : null,
    items,
  });
}

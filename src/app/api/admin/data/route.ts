import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const [events, users, candidates, assignments] = await Promise.all([
    db.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.user.findMany({ select: { id: true, name: true } }),
    db.candidate.findMany({ select: { id: true, fullName: true } }),
    db.candidateAssignment.findMany({
      select: {
        id: true,
        candidate: { select: { fullName: true } },
      },
    }),
  ]);

  const userNames = new Map(users.map((user) => [user.id, user.name]));
  const subjectNames = new Map<string, string>();
  for (const candidate of candidates) {
    subjectNames.set(candidate.id, candidate.fullName);
  }
  for (const assignment of assignments) {
    subjectNames.set(assignment.id, assignment.candidate.fullName);
  }

  const rows = events.map((event) => {
    const subjectLabel = event.subjectId
      ? (subjectNames.get(event.subjectId) ?? userNames.get(event.subjectId) ?? null)
      : null;
    return {
      id: event.id,
      action: event.action,
      actorId: event.actor,
      actorName: userNames.get(event.actor) ?? null,
      subjectId: event.subjectId,
      subjectExists: subjectLabel !== null,
      subjectLabel,
      createdAt: event.createdAt.toISOString(),
      meta: event.meta,
    };
  });

  return NextResponse.json({
    rows,
    retentionDays: env.RETENTION_DAYS,
    candidateCount: candidates.length,
  });
}

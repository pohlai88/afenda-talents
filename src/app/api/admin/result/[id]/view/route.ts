import { NextResponse } from "next/server";
import { requireHiringUser } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Auditable profile entrance. Using a plain anchor to this route avoids Next.js
 * prefetch producing false view events and makes the audit durable before navigation.
 * Direct profile URLs retain their own server-side audit fallback.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireHiringUser();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const { id } = await params;
  const assignment = await db.candidateAssignment.findUnique({
    where: { id },
    select: {
      id: true,
      hiringRoundId: true,
      result: { select: { id: true } },
    },
  });
  if (!assignment) {
    return new NextResponse("Candidate assignment not found", { status: 404 });
  }

  if (assignment.result) {
    await audit(session.userId, "result.viewed", assignment.id);
  }

  const destination = new URL(`/admin/candidate/${assignment.id}`, request.url);
  destination.searchParams.set("round", assignment.hiringRoundId);
  destination.searchParams.set("viewAudit", "1");
  return NextResponse.redirect(destination);
}

import { NextResponse } from "next/server";
import {
  currentAssignmentId,
  resolveAssignmentToken,
} from "@/lib/auth-candidate";
import { buildCandidateBlocks } from "@/lib/candidate-form";
import { db } from "@/lib/db";
import { loadVersionDocument } from "@/lib/version-document";

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
  if (assignment.status !== "STARTED") {
    return NextResponse.json(
      { error: "Consent is required", action: "reenter" },
      { status: 409 },
    );
  }

  const doc = await loadVersionDocument(assignment.assessmentVersionId);
  const blocks = buildCandidateBlocks(doc);

  const responses = await db.response.findMany({
    where: { assignmentId: assignment.id },
  });
  const saved: Record<string, { value?: number; textValue?: string }> = {};
  for (const response of responses) {
    saved[response.questionId] = {
      value: response.value ?? undefined,
      textValue: response.textValue ?? undefined,
    };
  }

  return NextResponse.json({ blocks, saved });
}

import { NextResponse } from "next/server";
import type { AssessmentFormItem } from "@/components/assessment-form";
import {
  currentAssignmentId,
  resolveAssignmentToken,
} from "@/lib/auth-candidate";
import { db } from "@/lib/db";
import { orderedAnswerableItems } from "@/lib/instrument-document";
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
  const answerable = orderedAnswerableItems(doc);
  const items: AssessmentFormItem[] = [];
  let order = 0;
  for (const item of answerable) {
    if (item.type === "likert") {
      order += 1;
      items.push({
        id: item.id,
        order,
        text: item.text,
        type: "likert",
        required: item.required,
      });
      continue;
    }
    if (item.type === "short_text" || item.type === "long_text") {
      order += 1;
      items.push({
        id: item.id,
        order,
        text: item.text,
        type: item.type,
        required: item.required,
        maxLength: item.maxLength,
        helperText: item.helperText,
      });
    }
  }

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

  return NextResponse.json({ items, saved });
}

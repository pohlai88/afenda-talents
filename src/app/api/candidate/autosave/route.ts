import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStartedAssignment } from "@/lib/auth-candidate";
import { loadVersionDocument } from "@/lib/version-document";
import { orderedAnswerableItems } from "@/lib/instrument-document";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    itemId: z.string().min(1),
    msOnItem: z.number().int().min(0),
    value: z.number().int().min(1).max(5).optional(),
    textValue: z.string().max(8000).optional(),
  })
  .refine((body) => body.value !== undefined || body.textValue !== undefined, {
    message: "value or textValue required",
  });

export async function POST(request: Request) {
  let assignment;
  try {
    assignment = await requireStartedAssignment();
  } catch {
    return NextResponse.json(
      { error: "Assessment is not available" },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }

  const { itemId, value, textValue, msOnItem } = parsed.data;
  const document = await loadVersionDocument(assignment.assessmentVersionId);
  const item = orderedAnswerableItems(document).find(
    (candidateItem) => candidateItem.id === itemId,
  );
  if (!item) {
    return NextResponse.json({ error: "Unknown item" }, { status: 400 });
  }

  if (item.type === "likert") {
    if (value === undefined) {
      return NextResponse.json(
        { error: "Likert value required" },
        { status: 400 },
      );
    }
  } else if (item.type === "short_text" || item.type === "long_text") {
    if (textValue === undefined) {
      return NextResponse.json(
        { error: "Text value required" },
        { status: 400 },
      );
    }
    if (item.maxLength && textValue.length > item.maxLength) {
      return NextResponse.json({ error: "Answer too long" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Unknown item" }, { status: 400 });
  }

  try {
    await db.$transaction(async (tx) => {
      const writable = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "CandidateAssignment"
        WHERE "id" = ${assignment.id}
          AND "status" = 'STARTED'::"AssignmentStatus"
        FOR UPDATE
      `;
      if (writable.length !== 1) throw new Error("Assignment is no longer writable");

      await tx.response.upsert({
        where: {
          assignmentId_questionId: {
            assignmentId: assignment.id,
            questionId: itemId,
          },
        },
        update: {
          value: item.type === "likert" ? value! : null,
          textValue: item.type === "likert" ? null : (textValue ?? null),
          msOnItem: { increment: msOnItem },
        },
        create: {
          assignmentId: assignment.id,
          questionId: itemId,
          value: item.type === "likert" ? value! : null,
          textValue: item.type === "likert" ? null : (textValue ?? null),
          msOnItem,
        },
      });
    });
  } catch {
    return NextResponse.json(
      { error: "Assessment is no longer available for changes" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}

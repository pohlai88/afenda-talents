import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAssignment } from "@/lib/auth-candidate";
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
	.refine((b) => b.value !== undefined || b.textValue !== undefined, {
		message: "value or textValue required",
	});

export async function POST(request: Request) {
	let assignment;
	try {
		assignment = await requireAssignment();
	} catch {
		return NextResponse.json({ error: "Assessment is not available" }, { status: 403 });
	}

	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid answer" }, { status: 400 });

	const { itemId, value, textValue, msOnItem } = parsed.data;
	const doc = await loadVersionDocument(assignment.assessmentVersionId);
	const item = orderedAnswerableItems(doc).find((i) => i.id === itemId);
	if (!item) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

	if (item.type === "likert") {
		if (value === undefined) {
			return NextResponse.json({ error: "Likert value required" }, { status: 400 });
		}
	} else if (item.type === "short_text" || item.type === "long_text") {
		if (textValue === undefined) {
			return NextResponse.json({ error: "Text value required" }, { status: 400 });
		}
		if (item.maxLength && textValue.length > item.maxLength) {
			return NextResponse.json({ error: "Answer too long" }, { status: 400 });
		}
	} else {
		return NextResponse.json({ error: "Unknown item" }, { status: 400 });
	}

	const existing = await db.response.findUnique({
		where: {
			assignmentId_questionId: {
				assignmentId: assignment.id,
				questionId: itemId,
			},
		},
		select: { msOnItem: true },
	});

	await db.response.upsert({
		where: {
			assignmentId_questionId: {
				assignmentId: assignment.id,
				questionId: itemId,
			},
		},
		update: {
			value: item.type === "likert" ? value! : null,
			textValue: item.type === "likert" ? null : (textValue ?? null),
			msOnItem: (existing?.msOnItem ?? 0) + msOnItem,
		},
		create: {
			assignmentId: assignment.id,
			questionId: itemId,
			value: item.type === "likert" ? value! : null,
			textValue: item.type === "likert" ? null : (textValue ?? null),
			msOnItem,
		},
	});

	return NextResponse.json({ ok: true });
}

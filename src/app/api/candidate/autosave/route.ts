import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAssignment } from "@/lib/auth-candidate";
import { loadVersionDocument } from "@/lib/version-document";
import { orderedAnswerableItems } from "@/lib/instrument-document";

export const runtime = "nodejs";

const bodySchema = z.object({
	itemId: z.string().min(1),
	value: z.number().int().min(1).max(5),
	msOnItem: z.number().int().min(0),
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

	const { itemId, value, msOnItem } = parsed.data;
	const doc = await loadVersionDocument(assignment.assessmentVersionId);
	const answerable = orderedAnswerableItems(doc);
	const item = answerable.find((i) => i.id === itemId && i.type === "likert");
	if (!item) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

	// Expand phase: Item rows still exist and Response.itemId FK requires them.
	const catalog = await db.item.findUnique({ where: { id: itemId }, select: { id: true } });
	if (!catalog) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

	const existing = await db.response.findUnique({
		where: {
			candidateId_itemId: {
				candidateId: assignment.candidateId,
				itemId,
			},
		},
		select: { msOnItem: true },
	});

	await db.response.upsert({
		where: {
			candidateId_itemId: {
				candidateId: assignment.candidateId,
				itemId,
			},
		},
		update: {
			value,
			msOnItem: (existing?.msOnItem ?? 0) + msOnItem,
			assignmentId: assignment.id,
			questionId: itemId,
		},
		create: {
			candidateId: assignment.candidateId,
			itemId,
			value,
			msOnItem,
			assignmentId: assignment.id,
			questionId: itemId,
		},
	});

	return NextResponse.json({ ok: true });
}

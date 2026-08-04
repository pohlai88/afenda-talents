import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireHiringUser } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { draftInstrumentDocumentSchema, parseDraftDocument } from "@/lib/instrument-draft";

export const runtime = "nodejs";

const patchSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	draftDocument: draftInstrumentDocumentSchema.optional(),
	status: z.enum(["ARCHIVED"]).optional(),
});

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireHiringUser();
	} catch {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;
	const assessment = await db.assessment.findUnique({
		where: { id },
		include: {
			versions: {
				orderBy: { versionNumber: "desc" },
				select: {
					id: true,
					versionNumber: true,
					publishedAt: true,
					publishedById: true,
				},
			},
		},
	});
	if (!assessment) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json({
		id: assessment.id,
		title: assessment.title,
		kind: assessment.kind,
		isSystem: assessment.isSystem,
		status: assessment.status,
		draftDocument: assessment.draftDocument,
		versions: assessment.versions,
	});
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	let session;
	try {
		session = await requireAdmin();
	} catch {
		return NextResponse.json({ error: "Admin access required" }, { status: 403 });
	}

	const { id } = await params;
	const assessment = await db.assessment.findUnique({ where: { id } });
	if (!assessment) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (assessment.status === "ARCHIVED") {
		return NextResponse.json({ error: "Archived assessments cannot be edited" }, { status: 409 });
	}

	const parsed = patchSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	}

	if (parsed.data.status === "ARCHIVED") {
		if (assessment.isSystem) {
			return NextResponse.json(
				{ error: "System assessments cannot be archived" },
				{ status: 409 },
			);
		}
		await db.assessment.update({
			where: { id },
			data: { status: "ARCHIVED" },
		});
		await audit(session.userId, "assessment.archived", id);
		return NextResponse.json({ ok: true });
	}

	const data: {
		title?: string;
		draftDocument?: ReturnType<typeof parseDraftDocument>;
		updatedAt?: Date;
	} = {};

	if (parsed.data.title !== undefined) {
		data.title = parsed.data.title.trim();
	}
	if (parsed.data.draftDocument !== undefined) {
		const draft = parseDraftDocument(parsed.data.draftDocument);
		data.draftDocument = draft;
		if (draft.title.trim()) data.title = draft.title.trim();
	}

	await db.assessment.update({
		where: { id },
		data,
	});

	return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}

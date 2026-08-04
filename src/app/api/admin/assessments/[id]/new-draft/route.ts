import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseDraftDocument } from "@/lib/instrument-draft";
import { parseInstrumentDocument } from "@/lib/instrument-document";

export const runtime = "nodejs";

/** Create a new editable draft from the latest published version. */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	let session;
	try {
		session = await requireAdmin();
	} catch {
		return NextResponse.json({ error: "Admin access required" }, { status: 403 });
	}

	const { id } = await params;
	const assessment = await db.assessment.findUnique({
		where: { id },
		include: {
			versions: { orderBy: { versionNumber: "desc" }, take: 1 },
		},
	});
	if (!assessment) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (assessment.status === "ARCHIVED") {
		return NextResponse.json({ error: "Archived assessments have no draft" }, { status: 409 });
	}
	if (assessment.draftDocument) {
		return NextResponse.json({ error: "A draft already exists" }, { status: 409 });
	}
	const latest = assessment.versions[0];
	if (!latest) {
		return NextResponse.json({ error: "No published version to copy" }, { status: 400 });
	}

	const document = parseInstrumentDocument(latest.document);
	const draft = parseDraftDocument(document);

	await db.assessment.update({
		where: { id },
		data: {
			draftDocument: draft,
			status: assessment.isSystem ? "PUBLISHED" : "DRAFT",
		},
	});

	await audit(session.userId, "assessment.created", id, {
		fromVersionId: latest.id,
		action: "new_draft_version",
	});

	return NextResponse.json({ ok: true });
}

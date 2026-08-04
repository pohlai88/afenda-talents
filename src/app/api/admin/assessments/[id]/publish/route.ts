import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
	collectPublishIssues,
	parseDraftDocument,
	publishBlockers,
} from "@/lib/instrument-draft";
import { parseInstrumentDocument } from "@/lib/instrument-document";

export const runtime = "nodejs";

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
		return NextResponse.json({ error: "Cannot publish an archived assessment" }, { status: 409 });
	}
	if (!assessment.draftDocument) {
		return NextResponse.json({ error: "No draft to publish" }, { status: 400 });
	}

	const draft = parseDraftDocument(assessment.draftDocument);
	let document;
	try {
		document = parseInstrumentDocument(draft);
	} catch (error) {
		return NextResponse.json(
			{
				error: "Draft failed structural validation",
				detail: error instanceof Error ? error.message : "Invalid document",
			},
			{ status: 400 },
		);
	}

	const issues = collectPublishIssues(document);
	const blockers = publishBlockers(issues);
	if (blockers.length > 0) {
		return NextResponse.json(
			{ error: "Publish blocked", issues },
			{ status: 400 },
		);
	}

	const nextNumber = (assessment.versions[0]?.versionNumber ?? 0) + 1;

	const version = await db.$transaction(async (tx) => {
		const created = await tx.assessmentVersion.create({
			data: {
				assessmentId: id,
				versionNumber: nextNumber,
				document,
				publishedById: session.userId,
			},
		});
		await tx.assessment.update({
			where: { id },
			data: {
				status: "PUBLISHED",
				title: document.title,
				draftDocument: Prisma.DbNull,
			},
		});
		return created;
	});

	await audit(session.userId, "assessment.published", id, {
		versionId: version.id,
		versionNumber: nextNumber,
	});

	return NextResponse.json({
		versionId: version.id,
		versionNumber: nextNumber,
		warnings: issues.filter((i) => i.level === "warning"),
	});
}

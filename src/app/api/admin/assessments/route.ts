import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireHiringUser } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { blankInstrumentDocument, parseDraftDocument } from "@/lib/instrument-draft";

export const runtime = "nodejs";

const createSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	fromAssessmentId: z.string().min(1).optional(),
	asTemplate: z.boolean().optional(),
});

export async function GET() {
	try {
		await requireHiringUser();
	} catch {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const assessments = await db.assessment.findMany({
		orderBy: { updatedAt: "desc" },
		include: {
			versions: {
				orderBy: { versionNumber: "desc" },
				select: { id: true, versionNumber: true, publishedAt: true },
			},
		},
	});

	return NextResponse.json({
		assessments: assessments.map((a) => ({
			id: a.id,
			title: a.title,
			kind: a.kind,
			isSystem: a.isSystem,
			status: a.status,
			hasDraft: a.draftDocument !== null,
			latestVersion: a.versions[0] ?? null,
		})),
	});
}

export async function POST(request: Request) {
	let session;
	try {
		session = await requireAdmin();
	} catch {
		return NextResponse.json({ error: "Admin access required" }, { status: 403 });
	}

	const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	}

	const { title, fromAssessmentId, asTemplate } = parsed.data;

	if (fromAssessmentId) {
		const source = await db.assessment.findUnique({
			where: { id: fromAssessmentId },
			include: {
				versions: { orderBy: { versionNumber: "desc" }, take: 1 },
			},
		});
		if (!source) {
			return NextResponse.json({ error: "Source assessment not found" }, { status: 404 });
		}
		const sourceDoc =
			source.draftDocument ??
			source.versions[0]?.document ??
			blankInstrumentDocument(source.title);
		const draft = parseDraftDocument(sourceDoc);
		draft.title = title?.trim() || `${source.title} (copy)`;

		const created = await db.assessment.create({
			data: {
				title: draft.title,
				kind: asTemplate ? "TEMPLATE" : "ORGANISATION",
				isSystem: false,
				status: "DRAFT",
				draftDocument: draft,
			},
		});
		await audit(session.userId, "assessment.duplicated", created.id, {
			fromAssessmentId: source.id,
		});
		return NextResponse.json({ id: created.id });
	}

	const draft = blankInstrumentDocument(title?.trim() || "Untitled assessment");
	const created = await db.assessment.create({
		data: {
			title: draft.title,
			kind: asTemplate ? "TEMPLATE" : "ORGANISATION",
			isSystem: false,
			status: "DRAFT",
			draftDocument: draft,
		},
	});
	await audit(session.userId, "assessment.created", created.id);
	return NextResponse.json({ id: created.id });
}

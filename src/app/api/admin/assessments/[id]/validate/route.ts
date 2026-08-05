import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
	collectPublishIssues,
	parseDraftDocument,
	publishBlockers,
} from "@/lib/instrument-draft";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import { assertInstrumentInvariants } from "@/lib/instrument-invariants";

export const runtime = "nodejs";

/** Validate draft without publishing. */
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
	const assessment = await db.assessment.findUnique({ where: { id } });
	if (!assessment) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (!assessment.draftDocument) {
		return NextResponse.json({ error: "No draft" }, { status: 400 });
	}

	const draft = parseDraftDocument(assessment.draftDocument);
	try {
		const document = parseInstrumentDocument(draft);

		const invariantIssues = assertInstrumentInvariants(document, "publish");
		const invariantErrors = invariantIssues.map((i) => ({
			level: "error" as const,
			code: i.code,
			message: i.message,
			path: i.path,
		}));

		const issues = collectPublishIssues(document);
		const allIssues = [...invariantErrors, ...issues];

		await audit(session.userId, "draft.validated", id, {
			errorCount: invariantErrors.length + publishBlockers(issues).length,
			warningCount: issues.filter((i) => i.level === "warning").length,
		});
		return NextResponse.json({
			ok: invariantErrors.length === 0 && publishBlockers(issues).length === 0,
			issues: allIssues,
		});
	} catch (error) {
		return NextResponse.json({
			ok: false,
			issues: [
				{
					level: "error" as const,
					code: "schema",
					message: error instanceof Error ? error.message : "Invalid document",
				},
			],
		});
	}
}

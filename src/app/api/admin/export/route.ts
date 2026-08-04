import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { COMPETENCY_CODES, orderedDimensionCodes } from "@/lib/instrument-labels";
import { normalizeContextFlags, normalizeDimensions } from "@/lib/result-display";

export const runtime = "nodejs";

function cell(value: string | number | null | undefined): string {
	const text = value === null || value === undefined ? "" : String(value);
	const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
	return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
	let session;
	try {
		session = await requireAdmin();
	} catch {
		return NextResponse.json({ error: "Admin access required" }, { status: 403 });
	}

	const assignments = await db.candidateAssignment.findMany({
		orderBy: { createdAt: "asc" },
		include: {
			candidate: { select: { email: true, fullName: true } },
			result: true,
			hiringRound: { select: { name: true } },
		},
	});

	const codesSeen = new Set<string>();
	const normalized = assignments.map((a) => {
		const dimensions = normalizeDimensions(a.result?.dimensionScores);
		for (const d of dimensions) codesSeen.add(d.code);
		return {
			a,
			dimensions,
			flags: normalizeContextFlags(a.result?.validityFlags),
		};
	});

	// Prefer codes present in results; fall back to Core competencies when export is empty.
	const dimCodes = orderedDimensionCodes(
		codesSeen.size > 0 ? [...codesSeen] : [...COMPETENCY_CODES],
	);

	const header = [
		"email",
		"full_name",
		"hiring_round",
		"status",
		"submitted_at",
		...dimCodes.map((c) => `${c.toLowerCase()}_scaled`),
		"context_triggered_count",
	];

	const rows = normalized.map(({ a, dimensions, flags }) => [
		a.candidate.email,
		a.candidate.fullName,
		a.hiringRound.name,
		a.status,
		a.submittedAt?.toISOString() ?? "",
		...dimCodes.map((code) => dimensions.find((d) => d.code === code)?.scaled ?? ""),
		flags.filter((f) => f.triggered).length,
	]);

	await audit(session.userId, "export.downloaded", undefined, {
		rowCount: rows.length,
	});

	const csv =
		"\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

	return new NextResponse(csv, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": 'attachment; filename="afenda-talents-results.csv"',
		},
	});
}

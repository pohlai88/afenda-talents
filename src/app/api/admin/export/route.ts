import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { COMPETENCY_CODES } from "@/lib/scoring";
import { normalizeContextFlags, normalizeDimensions } from "@/lib/result-display";

export const runtime = "nodejs";

const FLAG_KEYS = [
	"impressionManagement",
	"inconsistentResponding",
	"straightLining",
	"rushed",
	"rule-social-desirability",
	"rule-consistency",
	"rule-straight-line",
	"rule-rushed",
] as const;

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

	const header = [
		"email",
		"full_name",
		"hiring_round",
		"status",
		"submitted_at",
		...COMPETENCY_CODES.map((c) => `${c.toLowerCase()}_scaled`),
		"context_triggered_count",
	];

	const rows = assignments.map((a) => {
		const dimensions = normalizeDimensions(a.result?.dimensionScores);
		const flags = normalizeContextFlags(a.result?.validityFlags);
		return [
			a.candidate.email,
			a.candidate.fullName,
			a.hiringRound.name,
			a.status,
			a.submittedAt?.toISOString() ?? "",
			...COMPETENCY_CODES.map(
				(code) => dimensions.find((d) => d.code === code)?.scaled ?? "",
			),
			flags.filter((f) => f.triggered).length,
		];
	});

	void FLAG_KEYS;

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

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { DimensionScore, ValidityFlag } from "@/lib/scoring";
import { COMPETENCY_CODES } from "@/lib/scoring";

export const runtime = "nodejs";

const FLAG_CODES = [
  "impressionManagement",
  "inconsistentResponding",
  "straightLining",
  "rushed",
] as const;

/**
 * Escapes a CSV cell. The leading-character guard stops a value like `=cmd()` from
 * executing as a formula when the file is opened in Excel.
 */
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

  const candidates = await db.candidate.findMany({
    orderBy: { createdAt: "asc" },
    include: { result: true },
  });

  // Five scaled scores and four flags per row. Deliberately no combined column —
  // an overall number is the thing the spec forbids (build-skill invariant 9).
  const header = [
    "email",
    "full_name",
    "status",
    "submitted_at",
    ...COMPETENCY_CODES.map((c) => `${c.toLowerCase()}_scaled`),
    ...FLAG_CODES.map((f) => `flag_${f}`),
  ];

  const rows = candidates.map((c) => {
    const dimensions = (c.result?.dimensionScores ?? []) as unknown as DimensionScore[];
    const flags = (c.result?.validityFlags ?? []) as unknown as ValidityFlag[];
    return [
      c.email,
      c.fullName,
      c.status,
      c.submittedAt?.toISOString() ?? "",
      ...COMPETENCY_CODES.map((code) => dimensions.find((d) => d.code === code)?.scaled ?? ""),
      ...FLAG_CODES.map((code) => (flags.find((f) => f.code === code)?.triggered ? "yes" : "no")),
    ];
  });

  await audit(session.userId, "export.downloaded", undefined, { rowCount: rows.length });

  // The BOM makes Excel read the file as UTF-8 rather than the local codepage.
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="afenda-talents-results.csv"',
    },
  });
}

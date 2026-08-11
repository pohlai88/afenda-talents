import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import {
  COMPETENCY_CODES,
  orderedDimensionCodes,
} from "@/lib/instrument-labels";
import {
  normalizeContextFlags,
  normalizeDimensions,
} from "@/lib/result-display";
import { resolveOperationalRound } from "@/lib/round-context";

export const runtime = "nodejs";

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function filePart(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || "round";
}

export async function GET(request: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const requestedRoundId = new URL(request.url).searchParams.get("round");
  const { selected } = await resolveOperationalRound(requestedRoundId);
  if (!selected) {
    return NextResponse.json({ error: "No hiring round is available" }, { status: 404 });
  }

  const assignments = await db.candidateAssignment.findMany({
    where: { hiringRoundId: selected.id },
    orderBy: { createdAt: "asc" },
    include: {
      candidate: { select: { email: true, fullName: true } },
      result: true,
    },
  });

  const codesSeen = new Set<string>();
  const normalized = assignments.map((assignment) => {
    const dimensions = normalizeDimensions(assignment.result?.dimensionScores);
    for (const dimension of dimensions) codesSeen.add(dimension.code);
    return {
      assignment,
      dimensions,
      flags: normalizeContextFlags(assignment.result?.validityFlags),
    };
  });
  const dimCodes = orderedDimensionCodes(
    codesSeen.size > 0 ? [...codesSeen] : [...COMPETENCY_CODES],
  );

  const header = [
    "email",
    "full_name",
    "hiring_round",
    "status",
    "submitted_at",
    ...dimCodes.map((code) => `${code.toLowerCase()}_scaled`),
    "context_triggered_count",
  ];
  const rows = normalized.map(({ assignment, dimensions, flags }) => [
    assignment.candidate.email,
    assignment.candidate.fullName,
    selected.name,
    assignment.status,
    assignment.submittedAt?.toISOString() ?? "",
    ...dimCodes.map(
      (code) =>
        dimensions.find((dimension) => dimension.code === code)?.scaled ?? "",
    ),
    flags.filter((flag) => flag.triggered).length,
  ]);

  await audit(session.userId, "export.downloaded", undefined, {
    rowCount: rows.length,
    roundId: selected.id,
  });

  const csv =
    "\uFEFF" +
    [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="afenda-talents-${filePart(selected.name)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

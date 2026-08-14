import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHiringUser } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  DOWNLOAD_FORMATS,
  downloadHeaders,
  resolveExportSource,
} from "@/lib/instrument-download";
import { exportCsv } from "@/lib/instrument-template/csv";
import { exportWorkbook } from "@/lib/instrument-template/workbook";

export const runtime = "nodejs";

const querySchema = z.object({
  format: z.enum(DOWNLOAD_FORMATS).default("xlsx"),
  source: z.enum(["draft", "published"]).default("draft"),
});

/**
 * Download one assessment. `_Source` stamps the real base identity, so re-uploading
 * into this same assessment is recognised as an update and re-uploading as a new
 * assessment still works (D24 §16).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireHiringUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    format: url.searchParams.get("format") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown format or source" }, { status: 400 });
  }
  const { format, source } = parsed.data;

  const { id } = await params;
  const assessment = await db.assessment.findUnique({
    where: { id },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const latest = assessment.versions[0] ?? null;

  const resolved = resolveExportSource({
    source,
    draftDocument: assessment.draftDocument,
    latestDocument: latest?.document ?? null,
  });
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 409 });
  }
  const { document } = resolved;

  await audit(session.userId, "export.downloaded", assessment.id, {
    format,
    source,
  });

  const headers = downloadHeaders(format, assessment.title);

  if (format === "json") {
    return new NextResponse(JSON.stringify(document, null, 2), { headers });
  }
  if (format === "csv") {
    return new NextResponse(exportCsv(document) as unknown as BodyInit, { headers });
  }
  const workbook = await exportWorkbook(document, {
    sourceMode: source === "published" ? "strict" : "draft",
    baseAssessmentId: assessment.id,
    baseDraftRevision: assessment.draftRevision,
    basePublishedVersionNumber: latest?.versionNumber ?? null,
  });
  return new NextResponse(workbook as unknown as BodyInit, { headers });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHiringUser } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import {
  DOWNLOAD_FORMATS,
  TEMPLATE_KINDS,
  downloadHeaders,
  templateDocument,
} from "@/lib/instrument-download";
import { exportCsv } from "@/lib/instrument-template/csv";
import { exportWorkbook } from "@/lib/instrument-template/workbook";

export const runtime = "nodejs";

const querySchema = z.object({
  kind: z.enum(TEMPLATE_KINDS).default("blank"),
  format: z.enum(DOWNLOAD_FORMATS).default("xlsx"),
});

/**
 * A blank skeleton or a filled example to author from.
 *
 * `_Source` carries no `baseAssessmentId` (spec §4.1). That is deliberate: it is
 * what tells the importer this file is a new instrument rather than an edit of the
 * assessment it was generated from — otherwise downloading the Core example and
 * uploading it would present as an attempt to overwrite a seed-owned row.
 */
export async function GET(request: Request) {
  let session;
  try {
    session = await requireHiringUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    kind: url.searchParams.get("kind") ?? undefined,
    format: url.searchParams.get("format") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown template or format" }, { status: 400 });
  }

  const { kind, format } = parsed.data;
  const entry = templateDocument(kind);

  await audit(session.userId, "export.downloaded", undefined, {
    template: kind,
    format,
  });

  const headers = downloadHeaders(format, entry.title);

  if (format === "json") {
    return new NextResponse(JSON.stringify(entry.document, null, 2), { headers });
  }
  if (format === "csv") {
    return new NextResponse(exportCsv(entry.document) as unknown as BodyInit, { headers });
  }
  const workbook = await exportWorkbook(entry.document, {
    sourceMode: entry.sourceMode,
    baseAssessmentId: null,
  });
  return new NextResponse(workbook as unknown as BodyInit, { headers });
}

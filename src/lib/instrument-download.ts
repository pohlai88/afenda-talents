/**
 * What a download offers and how it is framed as a file. Pure module — no Prisma.
 *
 * The kind list is the single source for the Zod enum, the dialog options, and the
 * registry below, so shipping another example instrument is one entry rather than
 * four edits. `tests/unit/shipped-documents.test.ts` guards the same documents.
 */
import salesPerformanceRaw from "../../data/Sales_Performance_Role_Positioning_Assessment.json";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { blankInstrumentDocument } from "@/lib/instrument-draft";

export const DOWNLOAD_FORMATS = ["xlsx", "json", "csv"] as const;
export type DownloadFormat = (typeof DOWNLOAD_FORMATS)[number];

export const TEMPLATE_KINDS = ["blank", "core", "sales"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

const CONTENT_TYPE: Record<DownloadFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

export function filePart(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || "instrument";
}

export function downloadHeaders(
  format: DownloadFormat,
  name: string,
): Record<string, string> {
  return {
    "Content-Type": CONTENT_TYPE[format],
    "Content-Disposition": `attachment; filename="afenda-${filePart(name)}.${format}"`,
    "Cache-Control": "private, no-store",
  };
}

/**
 * `sourceMode: "draft"` on the blank skeleton is required, not cosmetic: a skeleton
 * is deliberately incomplete and a strict re-parse would reject it.
 */
export function templateDocument(kind: TemplateKind): {
  document: unknown;
  sourceMode: "strict" | "draft";
  title: string;
} {
  switch (kind) {
    case "blank":
      return {
        document: blankInstrumentDocument("Untitled assessment"),
        sourceMode: "draft",
        title: "instrument template",
      };
    case "core":
      return { document: CORE_V1_DOCUMENT, sourceMode: "strict", title: "core example" };
    case "sales":
      return {
        document: salesPerformanceRaw,
        sourceMode: "strict",
        title: "sales example",
      };
  }
}

/**
 * Which document a download should carry. Split out of the route so the fallback
 * rules are testable without a database: asking for the draft of an assessment
 * with no open draft gets the latest published document, which is what the builder
 * shows in the same situation.
 */
export function resolveExportSource(args: {
  source: "draft" | "published";
  draftDocument: unknown | null;
  latestDocument: unknown | null;
}): { document: unknown } | { error: string } {
  if (args.source === "published") {
    if (args.latestDocument === null) {
      return { error: "This assessment has no published version yet" };
    }
    return { document: args.latestDocument };
  }
  const document = args.draftDocument ?? args.latestDocument;
  if (document === null || document === undefined) {
    return { error: "This assessment has nothing to download yet" };
  }
  return { document };
}

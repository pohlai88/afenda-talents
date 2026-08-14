import { describe, expect, it } from "vitest";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import {
  DOWNLOAD_FORMATS,
  TEMPLATE_KINDS,
  downloadHeaders,
  filePart,
  resolveExportSource,
  templateDocument,
} from "@/lib/instrument-download";

describe("filePart", () => {
  it("slugifies a title", () => {
    expect(filePart("Sales Performance & Role Positioning")).toBe(
      "sales-performance-role-positioning",
    );
  });

  it("falls back when nothing survives", () => {
    expect(filePart("!!!")).toBe("instrument");
  });
});

describe("downloadHeaders", () => {
  it("sets an xlsx content type and attachment filename", () => {
    const headers = downloadHeaders("xlsx", "Core v1");
    expect(headers["Content-Type"]).toContain("spreadsheetml");
    expect(headers["Content-Disposition"]).toBe(
      'attachment; filename="afenda-core-v1.xlsx"',
    );
    expect(headers["Cache-Control"]).toBe("private, no-store");
  });

  it("sets json and csv content types", () => {
    expect(downloadHeaders("json", "x")["Content-Type"]).toContain("application/json");
    expect(downloadHeaders("csv", "x")["Content-Type"]).toContain("text/csv");
  });
});

describe("templateDocument", () => {
  it("covers every declared kind with a non-empty title", () => {
    for (const kind of TEMPLATE_KINDS) {
      expect(templateDocument(kind).title.length).toBeGreaterThan(0);
    }
  });

  it("strict-parses the two filled examples", () => {
    // Not "blank": blankInstrumentDocument() leaves consent copy and the one
    // item's text as empty strings, which the strict schema's min(1) rejects.
    // That is exactly why templateDocument marks it sourceMode "draft" below.
    for (const kind of ["core", "sales"] as const) {
      const entry = templateDocument(kind);
      expect(() => parseInstrumentDocument(entry.document)).not.toThrow();
    }
  });

  it("marks the blank skeleton as a draft, since strict parse would reject it", () => {
    expect(templateDocument("blank").sourceMode).toBe("draft");
  });

  it("marks filled examples as strict", () => {
    expect(templateDocument("core").sourceMode).toBe("strict");
    expect(templateDocument("sales").sourceMode).toBe("strict");
  });

  it("declares three formats", () => {
    expect([...DOWNLOAD_FORMATS]).toEqual(["xlsx", "json", "csv"]);
  });
});

describe("resolveExportSource", () => {
  it("returns the draft when one is open", () => {
    expect(
      resolveExportSource({
        source: "draft",
        draftDocument: { title: "draft" },
        latestDocument: { title: "published" },
      }),
    ).toEqual({ document: { title: "draft" } });
  });

  it("falls back to the published document when no draft is open", () => {
    expect(
      resolveExportSource({
        source: "draft",
        draftDocument: null,
        latestDocument: { title: "published" },
      }),
    ).toEqual({ document: { title: "published" } });
  });

  it("returns the published document when asked for it, ignoring an open draft", () => {
    expect(
      resolveExportSource({
        source: "published",
        draftDocument: { title: "draft" },
        latestDocument: { title: "published" },
      }),
    ).toEqual({ document: { title: "published" } });
  });

  it("errors when asked for published and there is none", () => {
    const result = resolveExportSource({
      source: "published",
      draftDocument: { title: "draft" },
      latestDocument: null,
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/no published version/i);
  });

  it("errors when there is nothing at all to download", () => {
    const result = resolveExportSource({
      source: "draft",
      draftDocument: null,
      latestDocument: null,
    });
    expect(result).toHaveProperty("error");
  });
});

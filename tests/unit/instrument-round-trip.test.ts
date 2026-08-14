import { describe, expect, it } from "vitest";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import { blankInstrumentDocument, parseDraftDocument } from "@/lib/instrument-draft";
import { exportWorkbook } from "@/lib/instrument-template/workbook";
import { previewImport } from "@/lib/instrument-template/merge";
import { exportCsv } from "@/lib/instrument-template/csv";
import { templateDocument } from "@/lib/instrument-download";

const coreDocument = parseInstrumentDocument(CORE_V1_DOCUMENT);

describe("export then import as a new assessment", () => {
  it("accepts a template export with no base identity", async () => {
    const bytes = await exportWorkbook(coreDocument, {
      sourceMode: "strict",
      baseAssessmentId: null,
    });
    const result = await previewImport({
      format: "xlsx",
      bytes,
      target: null,
      targetId: null,
      liveDraftRevision: null,
      livePublishedVersionNumber: null,
    });
    expect(result).not.toHaveProperty("refuse");
    if ("refuse" in result) return;
    expect(result.issues.filter((i) => i.severity === "hard")).toEqual([]);
    expect(result.committable).toBe(true);
  });

  it("accepts an assessment export re-imported as a new assessment", async () => {
    const bytes = await exportWorkbook(coreDocument, {
      sourceMode: "strict",
      baseAssessmentId: "asmt_source",
      baseDraftRevision: 3,
      basePublishedVersionNumber: 2,
    });
    const result = await previewImport({
      format: "xlsx",
      bytes,
      target: null,
      targetId: null,
      liveDraftRevision: null,
      livePublishedVersionNumber: null,
    });
    expect(result).not.toHaveProperty("refuse");
    if ("refuse" in result) return;
    expect(result.issues.filter((i) => i.severity === "hard")).toEqual([]);
  });

  it("refuses an export of A imported into B", async () => {
    const bytes = await exportWorkbook(coreDocument, {
      sourceMode: "strict",
      baseAssessmentId: "asmt_a",
      baseDraftRevision: 1,
      basePublishedVersionNumber: 1,
    });
    const result = await previewImport({
      format: "xlsx",
      bytes,
      target: coreDocument,
      targetId: "asmt_b",
      liveDraftRevision: 1,
      livePublishedVersionNumber: 1,
    });
    expect(result).toHaveProperty("refuse");
  });

  it("round-trips a blank draft template", async () => {
    const blank = blankInstrumentDocument();
    const bytes = await exportWorkbook(blank, { sourceMode: "draft", baseAssessmentId: null });
    const result = await previewImport({
      format: "xlsx",
      bytes,
      target: null,
      targetId: null,
      liveDraftRevision: null,
      livePublishedVersionNumber: null,
    });
    expect(result).not.toHaveProperty("refuse");
    if ("refuse" in result) return;
    expect(result.sourceMode).toBe("draft");
    expect(result.issues.filter((i) => i.severity === "hard")).toEqual([]);
  });
});

describe("every template downloads and imports back", () => {
  it.each(["blank", "core", "sales"] as const)(
    "%s round-trips through xlsx with no base identity",
    async (kind) => {
      const entry = templateDocument(kind);
      const bytes = await exportWorkbook(entry.document, {
        sourceMode: entry.sourceMode,
        baseAssessmentId: null,
      });
      const result = await previewImport({
        format: "xlsx",
        bytes,
        target: null,
        targetId: null,
        liveDraftRevision: null,
        livePublishedVersionNumber: null,
      });
      expect(result).not.toHaveProperty("refuse");
      if ("refuse" in result) return;
      expect(result.issues.filter((i) => i.severity === "hard")).toEqual([]);
    },
  );

  it("produces a non-empty CSV for a filled example", () => {
    const csv = exportCsv(templateDocument("sales").document);
    expect(csv.length).toBeGreaterThan(0);
    expect(csv.toString("utf8").split("\n").length).toBeGreaterThan(10);
  });
});

describe("a previewed import can actually be persisted", () => {
  // Regression: preview reported committable=true for the blank template, then
  // commit 400'd on `items[0].text: expected string, received undefined`. An
  // empty Excel cell read back as null and the parser left the key unset, so
  // every text cell of a blank template — legitimately empty — produced a
  // document the draft schema rejected. Preview alone never caught it: commit
  // is where parseDraftDocument runs. Found by walking the real app.
  it.each(["blank", "core", "sales"] as const)(
    "%s survives parseDraftDocument, which is what commit persists",
    async (kind) => {
      const entry = templateDocument(kind);
      const bytes = await exportWorkbook(entry.document, {
        sourceMode: entry.sourceMode,
        baseAssessmentId: null,
      });
      const result = await previewImport({
        format: "xlsx",
        bytes,
        target: null,
        targetId: null,
        liveDraftRevision: null,
        livePublishedVersionNumber: null,
      });
      expect(result).not.toHaveProperty("refuse");
      if ("refuse" in result) return;
      expect(result.committable).toBe(true);
      // The assertion that was missing.
      expect(() => parseDraftDocument(result.document)).not.toThrow();
    },
  );

  it("keeps an empty text cell as an empty string rather than dropping the key", async () => {
    const bytes = await exportWorkbook(blankInstrumentDocument(), {
      sourceMode: "draft",
      baseAssessmentId: null,
    });
    const result = await previewImport({
      format: "xlsx",
      bytes,
      target: null,
      targetId: null,
      liveDraftRevision: null,
      livePublishedVersionNumber: null,
    });
    if ("refuse" in result) throw new Error("expected a preview");
    const items = (result.document as { items: Array<Record<string, unknown>> }).items;
    const answerable = items.filter((i) => i.type !== "info");
    expect(answerable.length).toBeGreaterThan(0);
    for (const item of answerable) {
      expect(typeof item.text).toBe("string");
    }
  });
});

import { describe, expect, it } from "vitest";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import { blankInstrumentDocument } from "@/lib/instrument-draft";
import { exportWorkbook } from "@/lib/instrument-template/workbook";
import { previewImport } from "@/lib/instrument-template/merge";

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

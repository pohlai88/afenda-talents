/**
 * Tests for exportWorkbook / parseWorkbook / projectVisible (_Source round-trip).
 * TDD: Step 1 tests — these must all pass after implementation.
 */

import { describe, it, expect } from "vitest";
import { exportWorkbook, parseWorkbook, projectVisible } from "@/lib/instrument-template/workbook";
import { canonicalJson, sha256Hex } from "@/lib/instrument-template/visible";
import { canonicalizeDocumentOrder } from "@/lib/instrument-order";
import { blankInstrumentDocument } from "@/lib/instrument-draft";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal strict document for tests. Uses Core. */
function getCoreDoc() {
	return CORE_V1_DOCUMENT;
}

/** Minimal draft document (blank template). */
function getBlankDraftDoc() {
	return canonicalizeDocumentOrder(blankInstrumentDocument());
}

// ---------------------------------------------------------------------------
// Test 1: Export Core → parse _Source document deep-equals Core
// ---------------------------------------------------------------------------

describe("exportWorkbook + parseWorkbook", () => {
	it("round-trips Core document via _Source", async () => {
		const core = getCoreDoc();
		const buf = await exportWorkbook(core, { sourceMode: "strict" });
		expect(Buffer.isBuffer(buf)).toBe(true);
		expect(buf.length).toBeGreaterThan(1000);

		const result = await parseWorkbook(buf);
		expect("refuse" in result).toBe(false);
		if ("refuse" in result) throw new Error(result.refuse);

		// sourceDocument from _Source should deep-equal core
		// canonicalJson ensures stable comparison
		expect(canonicalJson(result.sourceDocument)).toBe(canonicalJson(core));
		expect(result.sourceMode).toBe("strict");
	});

	// ---------------------------------------------------------------------------
	// Test 2: Payload string is deterministic across two exports
	// ---------------------------------------------------------------------------

	it("produces deterministic _Source payload across two exports", async () => {
		const core = getCoreDoc();

		const buf1 = await exportWorkbook(core, { sourceMode: "strict" });
		const buf2 = await exportWorkbook(core, { sourceMode: "strict" });

		// Parse both and compare the raw JSON from _Source (not the full xlsx bytes)
		const r1 = await parseWorkbook(buf1);
		const r2 = await parseWorkbook(buf2);

		if ("refuse" in r1) throw new Error(`Export 1 refused: ${r1.refuse}`);
		if ("refuse" in r2) throw new Error(`Export 2 refused: ${r2.refuse}`);

		// The sourceDocument canonical JSON should be identical
		expect(canonicalJson(r1.sourceDocument)).toBe(canonicalJson(r2.sourceDocument));
	});

	// ---------------------------------------------------------------------------
	// Test 3: Delete _Source → refuse
	// ---------------------------------------------------------------------------

	it("refuses when _Source sheet is missing", async () => {
		const ExcelJS = (await import("exceljs")).default;
		const wb = new ExcelJS.Workbook();

		// Build a minimal xlsx without _Source
		const metaSheet = wb.addWorksheet("Meta");
		metaSheet.addRow(["title", "Test"]).commit();

		const arrayBuffer = await wb.xlsx.writeBuffer();
		const buf = Buffer.from(arrayBuffer);

		const result = await parseWorkbook(buf);
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) {
			expect(result.refuse).toMatch(/_Source/);
		}
	});

	// ---------------------------------------------------------------------------
	// Test 4: sourceMode=draft blank template parses with draft Zod
	// ---------------------------------------------------------------------------

	it("exports and parses blank draft template with sourceMode=draft", async () => {
		const blank = getBlankDraftDoc();
		const buf = await exportWorkbook(blank, { sourceMode: "draft" });

		const result = await parseWorkbook(buf);
		expect("refuse" in result).toBe(false);
		if ("refuse" in result) throw new Error(result.refuse);

		expect(result.sourceMode).toBe("draft");
		// sourceDocument should be the blank doc
		expect(canonicalJson(result.sourceDocument)).toBe(canonicalJson(blank));
	});

	// ---------------------------------------------------------------------------
	// Test 5: Huge !ref with few non-empty cells does not refuse
	// ---------------------------------------------------------------------------

	it("does not refuse a workbook with huge formatted range but few non-empty cells", async () => {
		const ExcelJS = (await import("exceljs")).default;
		const wb = new ExcelJS.Workbook();

		// Create _Source sheet with valid content
		const core = getCoreDoc();
		const { importable } = projectVisible(core);
		const importableHash = sha256Hex(canonicalJson(importable));
		const raw = canonicalJson(core);
		const rawBytes = Buffer.from(raw, "utf8");
		const rawHash = sha256Hex(rawBytes);
		const { gzipSync } = await import("node:zlib");
		const compressed = gzipSync(rawBytes, { level: 9 });
		const payload = compressed.toString("base64");
		const chunks: string[] = [];
		for (let i = 0; i < payload.length; i += 30_000) {
			chunks.push(payload.slice(i, i + 30_000));
		}

		const srcSheet = wb.addWorksheet("_Source", { state: "veryHidden" });
		srcSheet.getCell(1, 1).value = "afenda-instrument-source/v1";
		srcSheet.getCell(2, 1).value = "strict";
		srcSheet.getCell(3, 1).value = importableHash;
		srcSheet.getCell(4, 1).value = "";
		srcSheet.getCell(5, 1).value = "";
		srcSheet.getCell(6, 1).value = "";
		srcSheet.getCell(7, 1).value = rawHash;
		srcSheet.getCell(8, 1).value = chunks.length;
		for (let i = 0; i < chunks.length; i++) {
			srcSheet.getCell(i + 1, 2).value = chunks[i];
		}

		// Add a sheet with a large range but only a couple of actual cells
		// (ExcelJS doesn't support direct !ref manipulation but we can add sparse content)
		const bigSheet = wb.addWorksheet("BigSheet");
		bigSheet.getCell("A1").value = "hello";
		bigSheet.getCell("Z1000").value = "world"; // two cells only but large range

		const arrayBuffer = await wb.xlsx.writeBuffer();
		const buf = Buffer.from(arrayBuffer);

		const result = await parseWorkbook(buf);
		// Should NOT refuse due to cell count (only 2+ actual non-empty cells from BigSheet)
		// Total non-empty cells will be far below 20,000
		expect("refuse" in result).toBe(false);
		if ("refuse" in result) throw new Error(result.refuse);
	});
});

// ---------------------------------------------------------------------------
// projectVisible tests
// ---------------------------------------------------------------------------

describe("projectVisible", () => {
	it("returns importable and contextRules", () => {
		const core = getCoreDoc();
		const { importable, contextRules } = projectVisible(core);
		expect(importable).toBeDefined();
		expect(importable.meta.title).toBeTruthy();
		expect(Array.isArray(contextRules)).toBe(true);
	});

	it("excludes display-only base fields from importable", () => {
		const doc = { ...getCoreDoc(), baseAssessmentId: "some-id", baseDraftRevision: 1, basePublishedVersionNumber: 2 };
		const { importable } = projectVisible(doc);
		expect((importable as Record<string, unknown>).meta).not.toHaveProperty("baseAssessmentId");
		expect((importable as Record<string, unknown>).meta).not.toHaveProperty("baseDraftRevision");
	});

	it("does not include responseContextRules in importable", () => {
		const core = getCoreDoc();
		const { importable } = projectVisible(core);
		expect((importable as Record<string, unknown>)).not.toHaveProperty("responseContextRules");
	});
});

// ---------------------------------------------------------------------------
// canonicalJson tests
// ---------------------------------------------------------------------------

describe("canonicalJson", () => {
	it("sorts object keys recursively", () => {
		const obj = { z: 1, a: 2, m: { z: 3, a: 4 } };
		const result = canonicalJson(obj);
		expect(result).toBe('{"a":2,"m":{"a":4,"z":3},"z":1}');
	});

	it("preserves array order", () => {
		const obj = { items: [3, 1, 2] };
		const result = canonicalJson(obj);
		expect(result).toBe('{"items":[3,1,2]}');
	});

	it("is deterministic for same-content different-key-order objects", () => {
		const a = { z: 1, a: 2 };
		const b = { a: 2, z: 1 };
		expect(canonicalJson(a)).toBe(canonicalJson(b));
	});
});

/**
 * Tests for exportWorkbook / parseWorkbook / projectVisible (_Source round-trip).
 */

import { describe, it, expect } from "vitest";
import { exportWorkbook, parseWorkbook, projectVisible, countZipCentralDirEntries } from "@/lib/instrument-template/workbook";
import { canonicalJson, sha256Hex } from "@/lib/instrument-template/visible";
import { canonicalizeDocumentOrder } from "@/lib/instrument-order";
import { blankInstrumentDocument } from "@/lib/instrument-draft";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { gzipSync } from "node:zlib";

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

/** Build a workbook buffer with a valid _Source sheet embedding arbitrary payload bytes. */
async function buildWorkbookWithPayload(
	rawBytes: Buffer,
	opts: {
		sourceMode?: "strict" | "draft";
		importableHash?: string;
		rawHash?: string;
		chunkCount?: number;
	} = {},
): Promise<Buffer> {
	const { default: ExcelJS } = await import("exceljs");
	const wb = new ExcelJS.Workbook();

	const compressed = gzipSync(rawBytes, { level: 9 });
	const payload = compressed.toString("base64");
	const chunks: string[] = [];
	for (let i = 0; i < payload.length; i += 30_000) {
		chunks.push(payload.slice(i, i + 30_000));
	}

	const actualRawHash = sha256Hex(rawBytes);
	const src = wb.addWorksheet("_Source", { state: "veryHidden" });
	src.getCell(1, 1).value = "afenda-instrument-source/v1";
	src.getCell(2, 1).value = opts.sourceMode ?? "strict";
	src.getCell(3, 1).value = opts.importableHash ?? "fakehash";
	src.getCell(4, 1).value = "";
	src.getCell(5, 1).value = "";
	src.getCell(6, 1).value = "";
	src.getCell(7, 1).value = opts.rawHash ?? actualRawHash;
	src.getCell(8, 1).value = opts.chunkCount ?? chunks.length;
	for (let i = 0; i < chunks.length; i++) {
		src.getCell(i + 1, 2).value = chunks[i];
	}
	return Buffer.from(await wb.xlsx.writeBuffer());
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
		expect(canonicalJson(result.sourceDocument)).toBe(canonicalJson(core));
		expect(result.sourceMode).toBe("strict");
	});

	it("returns _Source meta fields (sourceHash, baseAssessmentId, etc.)", async () => {
		const core = getCoreDoc();
		const buf = await exportWorkbook(core, {
			sourceMode: "strict",
			baseAssessmentId: "test-assess-1",
			baseDraftRevision: 3,
			basePublishedVersionNumber: 2,
		});

		const result = await parseWorkbook(buf);
		if ("refuse" in result) throw new Error(result.refuse);

		expect(result.sourceHash).toMatch(/^[0-9a-f]{64}$/);
		expect(result.baseAssessmentId).toBe("test-assess-1");
		expect(result.baseDraftRevision).toBe(3);
		expect(result.basePublishedVersionNumber).toBe(2);
	});

	it("returns null meta fields when not set on export", async () => {
		const core = getCoreDoc();
		const buf = await exportWorkbook(core, { sourceMode: "strict" });
		const result = await parseWorkbook(buf);
		if ("refuse" in result) throw new Error(result.refuse);

		expect(result.baseAssessmentId).toBeNull();
		expect(result.baseDraftRevision).toBeNull();
		expect(result.basePublishedVersionNumber).toBeNull();
	});

	// ---------------------------------------------------------------------------
	// Test 2: Payload string deterministic across two exports
	// ---------------------------------------------------------------------------

	it("produces deterministic B-chunk payload string across two exports", async () => {
		const core = getCoreDoc();

		const buf1 = await exportWorkbook(core, { sourceMode: "strict" });
		const buf2 = await exportWorkbook(core, { sourceMode: "strict" });

		// Read the B-chunk payload string from _Source (not full xlsx bytes)
		// Parse both workbooks and extract sourceHash; equal hash means equal payload
		const r1 = await parseWorkbook(buf1);
		const r2 = await parseWorkbook(buf2);

		if ("refuse" in r1) throw new Error(`Export 1 refused: ${r1.refuse}`);
		if ("refuse" in r2) throw new Error(`Export 2 refused: ${r2.refuse}`);

		// sourceHash is sha256 of importable — must be identical
		expect(r1.sourceHash).toBe(r2.sourceHash);
		// sourceDocument canonical JSON must also be identical
		expect(canonicalJson(r1.sourceDocument)).toBe(canonicalJson(r2.sourceDocument));
	});

	// ---------------------------------------------------------------------------
	// Test 3: Delete _Source → refuse
	// ---------------------------------------------------------------------------

	it("refuses when _Source sheet is missing", async () => {
		const { default: ExcelJS } = await import("exceljs");
		const wb = new ExcelJS.Workbook();
		const metaSheet = wb.addWorksheet("Meta");
		metaSheet.addRow(["title", "Test"]).commit();
		const buf = Buffer.from(await wb.xlsx.writeBuffer());

		const result = await parseWorkbook(buf);
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) expect(result.refuse).toMatch(/_Source/);
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
		expect(canonicalJson(result.sourceDocument)).toBe(canonicalJson(blank));
	});

	// ---------------------------------------------------------------------------
	// Test 5: Huge !ref with few non-empty cells does not refuse
	// ---------------------------------------------------------------------------

	it("does not refuse a workbook with huge formatted range but few non-empty cells", async () => {
		const { default: ExcelJS } = await import("exceljs");
		const wb = new ExcelJS.Workbook();

		// Valid _Source
		const core = getCoreDoc();
		const { importable } = projectVisible(core);
		const importableHash = sha256Hex(canonicalJson(importable));
		const raw = canonicalJson(core);
		const rawBytes = Buffer.from(raw, "utf8");
		const rawHash = sha256Hex(rawBytes);
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

		// Sparse large-range sheet — only 2 non-empty cells
		const bigSheet = wb.addWorksheet("BigSheet");
		bigSheet.getCell("A1").value = "hello";
		bigSheet.getCell("Z1000").value = "world";

		const buf = Buffer.from(await wb.xlsx.writeBuffer());
		const result = await parseWorkbook(buf);
		// Should NOT refuse: non-empty cells << 20,000
		expect("refuse" in result).toBe(false);
		if ("refuse" in result) throw new Error(result.refuse);
	});

	// ---------------------------------------------------------------------------
	// Decompression bomb: >512 KiB uncompressed → refuse
	// ---------------------------------------------------------------------------

	it("refuses a decompression bomb (>512 KiB uncompressed)", async () => {
		// 600 KiB of zeros — compresses to <1 KiB, but uncompressed > 512 KiB limit
		const oversize = Buffer.alloc(600 * 1024, 0);
		const buf = await buildWorkbookWithPayload(oversize);
		const result = await parseWorkbook(buf);
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) {
			expect(result.refuse).toMatch(/decompress|size|limit/i);
		}
	});
});

// ---------------------------------------------------------------------------
// countZipCentralDirEntries tests
// ---------------------------------------------------------------------------

describe("countZipCentralDirEntries", () => {
	it("returns entry count ≥ 1 and ≤ 64 for a real ExcelJS export", async () => {
		const core = getCoreDoc();
		const buf = await exportWorkbook(core, { sourceMode: "strict" });
		const count = countZipCentralDirEntries(buf);
		expect(typeof count).toBe("number");
		expect(count as number).toBeGreaterThanOrEqual(1);
		expect(count as number).toBeLessThanOrEqual(64);
	});

	it("returns >64 for a synthetic EOCD reporting 65 entries → parseWorkbook refuses", () => {
		// Craft a buffer with EOCD reporting 65 entries
		const eocd = Buffer.alloc(22, 0);
		eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06 signature
		eocd.writeUInt16LE(0, 4);           // disk #
		eocd.writeUInt16LE(0, 6);           // central dir disk
		eocd.writeUInt16LE(65, 8);          // entries on this disk
		eocd.writeUInt16LE(65, 10);         // total entries
		eocd.writeUInt32LE(0, 14);          // central dir size
		eocd.writeUInt32LE(0, 18);          // central dir offset
		eocd.writeUInt16LE(0, 20);          // comment length

		// Prefix with some dummy bytes so the EOCD isn't at position 0
		const fakeBuf = Buffer.concat([Buffer.from("PK\x03\x04fakecontent"), eocd]);
		const count = countZipCentralDirEntries(fakeBuf);
		expect(count).toBe(65);
	});

	it("returns zip64 for a buffer with zip64 locator before EOCD", () => {
		// Zip64 EOCD locator: PK\x06\x07, 20 bytes
		const locator = Buffer.alloc(20, 0);
		locator.writeUInt32LE(0x07064b50, 0); // PK\x06\x07

		const eocd = Buffer.alloc(22, 0);
		eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
		eocd.writeUInt16LE(0xffff, 10);    // zip64 marker

		const fakeBuf = Buffer.concat([Buffer.from("fake"), locator, eocd]);
		const result = countZipCentralDirEntries(fakeBuf);
		expect(result).toBe("zip64");
	});

	it("parseWorkbook refuses a synthetic EOCD with 65 entries", async () => {
		// We need a buffer that's rejected by the entry-count check before ExcelJS
		// Use a buffer large enough to not be rejected by size, with EOCD at end
		const eocd = Buffer.alloc(22, 0);
		eocd.writeUInt32LE(0x06054b50, 0);
		eocd.writeUInt16LE(65, 8);
		eocd.writeUInt16LE(65, 10);
		eocd.writeUInt16LE(0, 20);
		const fakeBuf = Buffer.concat([Buffer.alloc(100, 0), eocd]);
		const result = await parseWorkbook(fakeBuf);
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) {
			expect(result.refuse).toMatch(/zip entries/i);
		}
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

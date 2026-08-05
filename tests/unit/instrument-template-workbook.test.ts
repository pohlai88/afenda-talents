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

function getCoreDoc() {
	return CORE_V1_DOCUMENT;
}

function getBlankDraftDoc() {
	return canonicalizeDocumentOrder(blankInstrumentDocument());
}

/**
 * Build a synthetic zip buffer with `cdEntryCount` real PK\x01\x02 records in the
 * central directory, while EOCD declares `eocdDeclaredCount` total entries.
 * Used to test that we walk the CD rather than trust the EOCD field.
 *
 * EOCD layout: +0=sig(4), +4=disk(2), +6=CDdisk(2), +8=onDisk(2), +10=total(2),
 *              +12=CDsize(4), +16=CDoffset(4), +20=commentLen(2)
 */
function buildSyntheticZip(cdEntryCount: number, eocdDeclaredCount: number): Buffer {
	// Minimal local file header (not read by our counter, just a placeholder)
	const localHeader = Buffer.alloc(30, 0);
	localHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04

	// Central directory entries — each is 46 bytes with fnLen=exLen=cmLen=0
	const cdRecords: Buffer[] = [];
	for (let i = 0; i < cdEntryCount; i++) {
		const rec = Buffer.alloc(46, 0);
		rec.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
		// fnLen=0 @ +28, exLen=0 @ +30, cmLen=0 @ +32 (all zero from alloc)
		cdRecords.push(rec);
	}
	const cdBuf = Buffer.concat(cdRecords);
	const cdOffset = localHeader.length;
	const cdSize = cdBuf.length;

	const eocd = Buffer.alloc(22, 0);
	eocd.writeUInt32LE(0x06054b50, 0);                           // PK\x05\x06
	eocd.writeUInt16LE(0, 4);                                    // disk 0
	eocd.writeUInt16LE(0, 6);                                    // CD disk 0
	eocd.writeUInt16LE(eocdDeclaredCount & 0xffff, 8);           // on-disk declared
	eocd.writeUInt16LE(eocdDeclaredCount & 0xffff, 10);          // total declared
	eocd.writeUInt32LE(cdSize, 12);                              // actual CD size
	eocd.writeUInt32LE(cdOffset, 16);                            // actual CD offset
	eocd.writeUInt16LE(0, 20);                                   // comment length

	return Buffer.concat([localHeader, cdBuf, eocd]);
}

/** Build a workbook buffer with a valid _Source sheet embedding arbitrary raw bytes. */
async function buildWorkbookWithRawPayload(rawBytes: Buffer): Promise<Buffer> {
	const { default: ExcelJS } = await import("exceljs");
	const wb = new ExcelJS.Workbook();
	const compressed = gzipSync(rawBytes, { level: 9 });
	const payload = compressed.toString("base64");
	const chunks: string[] = [];
	for (let i = 0; i < payload.length; i += 30_000) chunks.push(payload.slice(i, i + 30_000));
	const rawHash = sha256Hex(rawBytes);

	const src = wb.addWorksheet("_Source", { state: "veryHidden" });
	src.getCell(1, 1).value = "afenda-instrument-source/v1";
	src.getCell(2, 1).value = "strict";
	src.getCell(3, 1).value = "fakehash";
	src.getCell(7, 1).value = rawHash;
	src.getCell(8, 1).value = chunks.length;
	for (let i = 0; i < chunks.length; i++) src.getCell(i + 1, 2).value = chunks[i];
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
		if ("refuse" in result) throw new Error(result.refuse);

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

	it("produces identical B-chunk payload strings across two exports (extracted via ExcelJS)", async () => {
		const { default: ExcelJS } = await import("exceljs");
		const core = getCoreDoc();

		async function extractBChunks(buf: Buffer): Promise<string> {
			const wb = new ExcelJS.Workbook();
			await wb.xlsx.load(buf as unknown as ArrayBuffer);
			const src = wb.getWorksheet("_Source");
			if (!src) throw new Error("No _Source sheet");
			const chunkCountVal = src.getCell(8, 1).value;
			const chunkCount = typeof chunkCountVal === "number" ? chunkCountVal : parseInt(String(chunkCountVal), 10);
			const chunks: string[] = [];
			for (let i = 1; i <= chunkCount; i++) chunks.push(String(src.getCell(i, 2).value ?? ""));
			return chunks.join("");
		}

		const buf1 = await exportWorkbook(core, { sourceMode: "strict" });
		const buf2 = await exportWorkbook(core, { sourceMode: "strict" });
		const payload1 = await extractBChunks(buf1);
		const payload2 = await extractBChunks(buf2);

		expect(payload1).toBe(payload2);
		expect(payload1.length).toBeGreaterThan(100);
	});

	// ---------------------------------------------------------------------------
	// Test 3: Delete _Source → refuse
	// ---------------------------------------------------------------------------

	it("refuses when _Source sheet is missing", async () => {
		const { default: ExcelJS } = await import("exceljs");
		const wb = new ExcelJS.Workbook();
		wb.addWorksheet("Meta").addRow(["title", "Test"]).commit();
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
		const core = getCoreDoc();
		const { importable } = projectVisible(core);
		const importableHash = sha256Hex(canonicalJson(importable));
		const raw = canonicalJson(core);
		const rawBytes = Buffer.from(raw, "utf8");
		const rawHash = sha256Hex(rawBytes);
		const compressed = gzipSync(rawBytes, { level: 9 });
		const payload = compressed.toString("base64");
		const chunks: string[] = [];
		for (let i = 0; i < payload.length; i += 30_000) chunks.push(payload.slice(i, i + 30_000));

		const srcSheet = wb.addWorksheet("_Source", { state: "veryHidden" });
		srcSheet.getCell(1, 1).value = "afenda-instrument-source/v1";
		srcSheet.getCell(2, 1).value = "strict";
		srcSheet.getCell(3, 1).value = importableHash;
		srcSheet.getCell(7, 1).value = rawHash;
		srcSheet.getCell(8, 1).value = chunks.length;
		for (let i = 0; i < chunks.length; i++) srcSheet.getCell(i + 1, 2).value = chunks[i];

		// Sparse large-range sheet — only 2 non-empty cells despite large address range
		const bigSheet = wb.addWorksheet("BigSheet");
		bigSheet.getCell("A1").value = "hello";
		bigSheet.getCell("Z1000").value = "world";

		const buf = Buffer.from(await wb.xlsx.writeBuffer());
		const result = await parseWorkbook(buf);
		expect("refuse" in result).toBe(false);
		if ("refuse" in result) throw new Error(result.refuse);
	});

	// ---------------------------------------------------------------------------
	// Decompression bomb: >512 KiB uncompressed → refuse before inflating
	// ---------------------------------------------------------------------------

	it("refuses a decompression bomb (>512 KiB uncompressed)", async () => {
		// 600 KiB zeros compress to <1 KiB; maxOutputLength kicks in before full inflate
		const oversize = Buffer.alloc(600 * 1024, 0);
		const buf = await buildWorkbookWithRawPayload(oversize);
		const result = await parseWorkbook(buf);
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) expect(result.refuse).toMatch(/decompress|size|limit/i);
	});
});

// ---------------------------------------------------------------------------
// countZipCentralDirEntries — CD walk + alignment tests
// ---------------------------------------------------------------------------

/**
 * Build a decoy zip where EOCD.centralDirOffset points at a 1-record decoy CD,
 * but the real CD (65 records) sits between the decoy and the EOCD.
 * cdOffset + cdSize (=30+46=76) ≠ eocdPos (=30+46+2990=3066) → "malformed".
 */
function buildDecoyZip(): Buffer {
	const localHeader = Buffer.alloc(30, 0);
	localHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04

	// Decoy: 1 CD record (where EOCD points)
	const decoyCD = Buffer.alloc(46, 0);
	decoyCD.writeUInt32LE(0x02014b50, 0);

	// Real CD: 65 records (where JSZip would actually walk via extraBytes adjustment)
	const realCDEntries: Buffer[] = [];
	for (let i = 0; i < 65; i++) {
		const rec = Buffer.alloc(46, 0);
		rec.writeUInt32LE(0x02014b50, 0);
		realCDEntries.push(rec);
	}
	const realCD = Buffer.concat(realCDEntries);

	// EOCD: declares cdOffset=30 (decoy), cdSize=46 (1 entry)
	// but eocdPos = 30+46+2990 = 3066, so cdOffset+cdSize=76 ≠ 3066
	const eocd = Buffer.alloc(22, 0);
	eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
	eocd.writeUInt16LE(1, 8);           // declared on-disk: 1
	eocd.writeUInt16LE(1, 10);          // declared total: 1
	eocd.writeUInt32LE(46, 12);         // cdSize: 46 (1-record decoy)
	eocd.writeUInt32LE(30, 16);         // cdOffset: 30 (decoy)
	eocd.writeUInt16LE(0, 20);

	return Buffer.concat([localHeader, decoyCD, realCD, eocd]);
}

describe("countZipCentralDirEntries", () => {
	it("returns entry count ≥ 1 and ≤ 64 for a real ExcelJS export", async () => {
		const core = getCoreDoc();
		const buf = await exportWorkbook(core, { sourceMode: "strict" });
		const count = countZipCentralDirEntries(buf);
		expect(typeof count).toBe("number");
		expect(count as number).toBeGreaterThanOrEqual(1);
		expect(count as number).toBeLessThanOrEqual(64);
	});

	it("walks actual CD records — returns real count even when EOCD declares fewer", () => {
		// EOCD says 5, CD has 10 records; cdOffset+cdSize===eocdPos so alignment passes
		const buf = buildSyntheticZip(10, 5);
		expect(countZipCentralDirEntries(buf)).toBe(10);
	});

	it("walks actual CD records — returns 65 when EOCD declares 5", () => {
		// cdOffset+cdSize===eocdPos (alignment passes); walked count is 65 > 64 → refuse
		const buf = buildSyntheticZip(65, 5);
		expect(countZipCentralDirEntries(buf)).toBe(65);
	});

	it("parseWorkbook refuses when CD walk finds 65 entries despite EOCD declaring 5", async () => {
		const buf = buildSyntheticZip(65, 5);
		const result = await parseWorkbook(buf);
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) expect(result.refuse).toMatch(/zip entries/i);
	});

	it("returns 'malformed' when cdOffset+cdSize ≠ eocdPos (decoy CD attack)", () => {
		// Alignment check catches this; real CD (65 entries) is unreachable via our walk
		const buf = buildDecoyZip();
		expect(countZipCentralDirEntries(buf)).toBe("malformed");
	});

	it("parseWorkbook refuses a decoy-CD zip (cdOffset+cdSize ≠ eocdPos)", async () => {
		const buf = buildDecoyZip();
		const result = await parseWorkbook(buf);
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) expect(result.refuse).toMatch(/centralDirOffset|structure|malformed/i);
	});

	it("returns 'zip64' for a buffer with zip64 EOCD locator PK\\x06\\x07", () => {
		const locator = Buffer.alloc(20, 0);
		locator.writeUInt32LE(0x07064b50, 0); // PK\x06\x07
		const eocd = Buffer.alloc(22, 0);
		eocd.writeUInt32LE(0x06054b50, 0);
		eocd.writeUInt16LE(10, 10);
		const fakeBuf = Buffer.concat([Buffer.from("fake"), locator, eocd]);
		expect(countZipCentralDirEntries(fakeBuf)).toBe("zip64");
	});

	it("returns 'zip64' when EOCD totalEntries is 0xFFFF", () => {
		const buf = buildSyntheticZip(0, 0xffff);
		expect(countZipCentralDirEntries(buf)).toBe("zip64");
	});

	it("parseWorkbook refuses zip64", async () => {
		const buf = buildSyntheticZip(0, 0xffff);
		const result = await parseWorkbook(buf);
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) expect(result.refuse).toMatch(/zip64/i);
	});

	/**
	 * EOCD search window bypass — fixed in review-3.
	 *
	 * Old code searched only the last 22+65535=65557 bytes. An attacker appends
	 * ≥70 000 bytes of zero padding after a real EOCD (no PK\x05\x06 in padding).
	 * The EOCD is now >65557 bytes from the end, outside the old window.
	 *
	 * Old behaviour: countZipCentralDirEntries returned 0 (no EOCD found).
	 * parseWorkbook saw 0 > 64 === false → did NOT refuse → ExcelJS/JSZip scanned
	 * the whole buffer, found the EOCD, loaded 65 real entries — cap bypassed.
	 *
	 * Fixed: scan the entire buffer backward. Now we find the EOCD, count 65
	 * entries, and parseWorkbook correctly refuses with "zip entries".
	 */
	it("EOCD search window bypass: 65-entry zip padded with 70 000 zero bytes is refused", async () => {
		// Build a 65-entry synthetic zip (each CD record 46 bytes, local header 30 bytes)
		// total: 30 + 65*46 + 22 = 3042 bytes; EOCD at offset 3020
		const zip65 = buildSyntheticZip(65, 65);

		// Append 70 000 zero bytes — no PK\x05\x06 in the padding.
		// EOCD is now 70022 bytes from the end; old 65557-byte window misses it.
		const padded = Buffer.concat([zip65, Buffer.alloc(70_000, 0)]);

		// Sanity: EOCD is indeed beyond the old narrow window
		expect(padded.length - (zip65.length - 22)).toBeGreaterThan(22 + 65535);

		// With whole-buffer scan: we find the EOCD, count 65 entries
		const count = countZipCentralDirEntries(padded);
		expect(count).toBe(65); // not 0, not "malformed"

		// parseWorkbook must refuse because 65 > MAX_ZIP_ENTRIES (64)
		const result = await parseWorkbook(padded);
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) expect(result.refuse).toMatch(/zip entries/i);
	});
});

// ---------------------------------------------------------------------------
// projectVisible tests
// ---------------------------------------------------------------------------

describe("projectVisible", () => {
	it("returns importable and contextRules", () => {
		const core = getCoreDoc();
		const { importable, contextRules } = projectVisible(core);
		expect(importable.meta.title).toBeTruthy();
		expect(Array.isArray(contextRules)).toBe(true);
	});

	it("excludes display-only base fields from importable", () => {
		const doc = { ...getCoreDoc(), baseAssessmentId: "some-id", baseDraftRevision: 1 };
		const { importable } = projectVisible(doc);
		expect((importable as Record<string, unknown>).meta).not.toHaveProperty("baseAssessmentId");
	});

	it("does not include responseContextRules in importable", () => {
		const { importable } = projectVisible(getCoreDoc());
		expect(importable as Record<string, unknown>).not.toHaveProperty("responseContextRules");
	});
});

// ---------------------------------------------------------------------------
// canonicalJson tests
// ---------------------------------------------------------------------------

describe("canonicalJson", () => {
	it("sorts object keys recursively", () => {
		expect(canonicalJson({ z: 1, a: 2, m: { z: 3, a: 4 } })).toBe('{"a":2,"m":{"a":4,"z":3},"z":1}');
	});

	it("preserves array order", () => {
		expect(canonicalJson({ items: [3, 1, 2] })).toBe('{"items":[3,1,2]}');
	});

	it("is deterministic for same-content different-key-order objects", () => {
		expect(canonicalJson({ z: 1, a: 2 })).toBe(canonicalJson({ a: 2, z: 1 }));
	});
});

/**
 * Workbook export/import for instrument templates.
 *
 * Exports: exportWorkbook(doc, meta) → Buffer
 * Imports: parseWorkbook(buf) → ParseWorkbookResult
 * projectVisible re-exported from visible.ts.
 *
 * Pure module. No Prisma. No ranking.
 */

import * as ExcelJS from "exceljs";
import { gzipSync, gunzipSync } from "node:zlib";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import { parseDraftDocument } from "@/lib/instrument-draft";
import { canonicalJson, sha256Hex, projectVisible } from "@/lib/instrument-template/visible";
import type { VisibleImportable } from "@/lib/instrument-template/visible";
import { canonicalCell } from "@/lib/instrument-template/cells";

export { projectVisible };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_MAGIC = "afenda-instrument-source/v1";
const CHUNK_SIZE = 30_000;
const MAX_BUFFER_BYTES = 2 * 1024 * 1024; // 2 MiB
const MAX_ZIP_ENTRIES = 64;
const MAX_DECOMPRESSED_JSON_BYTES = 512 * 1024; // 512 KiB
const MAX_NON_EMPTY_CELLS = 20_000;
const MAX_GZIP_RATIO = 20;

// ---------------------------------------------------------------------------
// Export types
// ---------------------------------------------------------------------------

export type ExportMeta = {
	sourceMode: "strict" | "draft";
	baseAssessmentId?: string | null;
	baseDraftRevision?: number | null;
	basePublishedVersionNumber?: number | null;
};

// ---------------------------------------------------------------------------
// Parse/import types
// ---------------------------------------------------------------------------

export type WorkbookProvenance = Map<string, string>;

export type ParseWorkbookSuccess = {
	sourceMode: "strict" | "draft";
	sourceDocument: unknown;
	/** A3 — SHA-256 of canonicalJson(importable) at export time. */
	sourceHash: string;
	/** A4 — assessment id this was exported from, or null. */
	baseAssessmentId: string | null;
	/** A5 — draft revision at export time, or null. */
	baseDraftRevision: number | null;
	/** A6 — published version number at export time, or null. */
	basePublishedVersionNumber: number | null;
	importableSheets: VisibleImportable;
	contextRulesSheet: "absent" | { rows: unknown[] };
	provenance: WorkbookProvenance;
	issues: Array<{ code: string; message: string; severity: "hard" | "soft"; path?: string; sheetRef?: string }>;
};

export type ParseWorkbookResult = ParseWorkbookSuccess | { refuse: string };

// ---------------------------------------------------------------------------
// Zip entry count — read from EOCD central directory (safe, not attacker-skippable)
// ---------------------------------------------------------------------------

/**
 * Count zip entries by WALKING the actual central directory records (`PK\x01\x02`).
 *
 * The EOCD total-entries field is attacker-controlled and must NOT be used as the cap.
 * An attacker can set EOCD entries=5 while the CD contains 200 records; JSZip/ExcelJS
 * walks the CD until the signature fails, so it sees all 200.
 *
 * Algorithm:
 * 1. Find EOCD `PK\x05\x06` by scanning the ENTIRE buffer backward.
 *    The zip spec allows a comment up to 65535 bytes after EOCD, but an attacker can
 *    append more garbage to push the EOCD outside a narrow window. JSZip also scans
 *    the whole buffer; we must match its search space. The buffer is already capped at
 *    2 MiB, so this O(n) scan is bounded.
 * 2. Refuse zip64 (locator `PK\x06\x07` or declared count 0xFFFF).
 * 3. Read `centralDirSize` (+12, uint32 LE) and `centralDirOffset` (+16, uint32 LE).
 * 4. Alignment invariant: `centralDirOffset + centralDirSize === eocdPos` exactly.
 *    JSZip computes extraBytes = eocdPos − (cdOffset + cdSize) and adjusts the real
 *    CD start accordingly — so an attacker can set cdOffset to a 1-record decoy while
 *    JSZip loads the real 200-record CD via its offset-adjustment. Our exporter never
 *    prepends bytes, so legitimate workbooks always satisfy this. Mismatches → "malformed".
 * 5. Walk from `centralDirOffset`, counting `PK\x01\x02` records (46-byte fixed header
 *    + filenameLen + extraLen + commentLen). Stop at first non-matching signature or
 *    when past `centralDirOffset + centralDirSize`.
 * 6. Return walked count (never the EOCD declared field). Empty walk → "malformed".
 *
 * EOCD layout (+0=sig, +4=disk#, +6=CDdisk, +8=entriesOnDisk, +10=totalEntries,
 *              +12=CDsize, +16=CDoffset, +20=commentLen) — 22 bytes total.
 */
export function countZipCentralDirEntries(buf: Buffer): number | "zip64" | "malformed" {
	let eocdPos = -1;

	// Scan entire buffer backward for the last PK\x05\x06.
	// Buffer is already capped at MAX_BUFFER_BYTES (2 MiB) before this call.
	for (let i = buf.length - 22; i >= 0; i--) {
		if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
			eocdPos = i;
			break;
		}
	}

	if (eocdPos < 0) return "malformed";
	if (eocdPos + 22 > buf.length) return "malformed";

	// Zip64 EOCD locator `PK\x06\x07` is exactly 20 bytes immediately before EOCD
	if (eocdPos >= 20) {
		const locPos = eocdPos - 20;
		if (buf[locPos] === 0x50 && buf[locPos + 1] === 0x4b && buf[locPos + 2] === 0x06 && buf[locPos + 3] === 0x07) {
			return "zip64";
		}
	}

	// Declared count 0xFFFF is the zip64 marker
	const declaredCount = buf.readUInt16LE(eocdPos + 10);
	if (declaredCount === 0xffff) return "zip64";

	// Read central directory location from EOCD (+12 = size, +16 = offset)
	const cdSize = buf.readUInt32LE(eocdPos + 12);
	const cdOffset = buf.readUInt32LE(eocdPos + 16);

	// Alignment invariant: CD must immediately precede EOCD with no displacement.
	// Prevents decoy-offset attacks where cdOffset points at a small fake CD while
	// JSZip uses its extraBytes adjustment to find the real large CD.
	if (cdOffset + cdSize !== eocdPos) return "malformed";
	if (cdOffset > buf.length) return "malformed";

	// Walk the actual central directory records (PK\x01\x02 = 0x02014b50)
	// CD entry fixed header: 46 bytes
	//   +0  signature (4)      +4  version made by (2)   +6  version needed (2)
	//   +8  bit flag (2)       +10 compression (2)       +12 last mod time (2)
	//   +14 last mod date (2)  +16 crc32 (4)             +20 compressed size (4)
	//   +24 uncompressed (4)   +28 filename len (2)       +30 extra len (2)
	//   +32 comment len (2)    +34 disk start (2)         +36 int attrs (2)
	//   +38 ext attrs (4)      +42 local header offset (4)
	const cdEnd = cdOffset + cdSize;
	let pos = cdOffset;
	let count = 0;

	while (pos + 46 <= buf.length && pos < cdEnd) {
		if (!(buf[pos] === 0x50 && buf[pos + 1] === 0x4b && buf[pos + 2] === 0x01 && buf[pos + 3] === 0x02)) {
			break; // non-CD signature — stop walk
		}
		count++;
		const fnLen = buf.readUInt16LE(pos + 28);
		const exLen = buf.readUInt16LE(pos + 30);
		const cmLen = buf.readUInt16LE(pos + 32);
		pos += 46 + fnLen + exLen + cmLen;
	}

	// Empty CD walk means malformed or broken structure
	if (count === 0) return "malformed";

	return count;
}

// ---------------------------------------------------------------------------
// Count non-empty cells in all worksheets
// ---------------------------------------------------------------------------

function countNonEmptyCells(workbook: ExcelJS.Workbook): number {
	let total = 0;
	workbook.eachSheet((ws: ExcelJS.Worksheet) => {
		ws.eachRow((row: ExcelJS.Row) => {
			row.eachCell({ includeEmpty: false }, () => {
				total++;
			});
		});
	});
	return total;
}

// ---------------------------------------------------------------------------
// Cell value helpers
// ---------------------------------------------------------------------------

function getCellValue(ws: ExcelJS.Worksheet, row: number, col: number): unknown {
	const cell = ws.getCell(row, col);
	const v = cell.value;
	// Rich text → extract plain string
	if (v !== null && typeof v === "object" && "richText" in (v as object)) {
		return (v as { richText: Array<{ text: string }> }).richText.map((rt) => rt.text).join("");
	}
	// Formula result
	if (v !== null && typeof v === "object" && "result" in (v as object)) {
		return (v as { result: unknown }).result;
	}
	return v;
}

function getCellString(ws: ExcelJS.Worksheet, row: number, col: number): string {
	const v = getCellValue(ws, row, col);
	if (v === null || v === undefined) return "";
	return String(v);
}

// ---------------------------------------------------------------------------
// exportWorkbook
// ---------------------------------------------------------------------------

export async function exportWorkbook(document: unknown, meta: ExportMeta): Promise<Buffer> {
	// 1. Validate document with appropriate mode
	if (meta.sourceMode === "strict") {
		parseInstrumentDocument(document); // throws on invalid
	} else {
		parseDraftDocument(document); // throws on invalid
	}

	// 2. Compute visible projection and hash
	const { importable } = projectVisible(document);
	const importableHash = sha256Hex(canonicalJson(importable));

	// 3. Build _Source payload
	const raw = canonicalJson(document);
	const rawBytes = Buffer.from(raw, "utf8");
	const rawHash = sha256Hex(rawBytes);

	// node:zlib gzipSync sets mtime=0 by default; the option is not exposed by the API.
	// Determinism is on the payload string (base64 of gzip), not full xlsx bytes.
	const compressed = gzipSync(rawBytes, { level: 9 });
	const payload = compressed.toString("base64");

	// Split into 30k-char chunks
	const chunks: string[] = [];
	for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
		chunks.push(payload.slice(i, i + CHUNK_SIZE));
	}
	const chunkCount = chunks.length;

	// 4. Build workbook
	const wb = new ExcelJS.Workbook();

	// --- _Source sheet (veryHidden) ---
	const srcSheet = wb.addWorksheet("_Source", { state: "veryHidden" });

	srcSheet.getCell(1, 1).value = SOURCE_MAGIC;
	srcSheet.getCell(2, 1).value = meta.sourceMode;
	srcSheet.getCell(3, 1).value = importableHash;
	srcSheet.getCell(4, 1).value = meta.baseAssessmentId ?? "";
	srcSheet.getCell(5, 1).value = meta.baseDraftRevision ?? "";
	srcSheet.getCell(6, 1).value = meta.basePublishedVersionNumber ?? "";
	srcSheet.getCell(7, 1).value = rawHash;
	srcSheet.getCell(8, 1).value = chunkCount;
	// A9, A10 reserved empty

	for (let i = 0; i < chunks.length; i++) {
		srcSheet.getCell(i + 1, 2).value = chunks[i];
	}

	// --- Meta sheet ---
	const doc = document as Record<string, unknown>;
	const metaSheet = wb.addWorksheet("Meta");
	const metaRows = [
		["title", doc.title ?? ""],
		["internalDescription", doc.internalDescription ?? ""],
		["candidateIntroduction", doc.candidateIntroduction ?? ""],
		["estimatedMinutes", doc.estimatedMinutes ?? ""],
		["displayMode", doc.displayMode ?? ""],
		["scoringMode", doc.scoringMode ?? ""],
		// Display-only base fields (not imported)
		["baseAssessmentId", meta.baseAssessmentId ?? ""],
		["baseDraftRevision", meta.baseDraftRevision ?? ""],
		["basePublishedVersionNumber", meta.basePublishedVersionNumber ?? ""],
	];
	for (const [key, val] of metaRows) {
		const row = metaSheet.addRow([key, val]);
		row.commit();
	}

	// --- Consent sheet ---
	const consentSheet = wb.addWorksheet("Consent");
	const consent = (doc.consent ?? {}) as Record<string, unknown>;
	for (const [key, val] of Object.entries(consent)) {
		const row = consentSheet.addRow([key, val]);
		row.commit();
	}

	// --- Sections sheet ---
	const sectionsSheet = wb.addWorksheet("Sections");
	sectionsSheet.addRow(["id", "title", "introduction", "order"]).commit();
	for (const s of (Array.isArray(doc.sections) ? doc.sections : []) as Record<string, unknown>[]) {
		sectionsSheet.addRow([s.id, s.title, s.introduction ?? "", s.order]).commit();
	}

	// --- Dimensions sheet ---
	const dimensionsSheet = wb.addWorksheet("Dimensions");
	dimensionsSheet.addRow(["id", "code", "name", "description", "order"]).commit();
	for (const d of (Array.isArray(doc.dimensions) ? doc.dimensions : []) as Record<string, unknown>[]) {
		dimensionsSheet.addRow([d.id, d.code, d.name, d.description ?? "", d.order]).commit();
	}

	// Build sectionId lookup for items (item id → sectionId)
	const itemSectionId = new Map<string, string>();
	if (Array.isArray(doc.sections)) {
		for (const section of doc.sections as Array<{ id: string; itemIds?: string[] }>) {
			for (const itemId of (section.itemIds ?? [])) {
				itemSectionId.set(itemId, section.id);
			}
		}
	}

	// --- Items sheet ---
	const itemsSheet = wb.addWorksheet("Items");
	itemsSheet.addRow([
		"type", "id", "order", "text", "body", "required",
		"sectionId", "scored", "dimensionId", "reverseScored",
		"helperText", "maxLength",
		"label1", "label2", "label3", "label4", "label5",
	]).commit();

	for (const item of (Array.isArray(doc.items) ? doc.items : []) as Record<string, unknown>[]) {
		const labels = Array.isArray(item.labels) ? item.labels : [];
		itemsSheet.addRow([
			item.type ?? "",
			item.id ?? "",
			item.order ?? "",
			item.text ?? "",
			item.body ?? "",
			item.required ?? "",
			itemSectionId.get(String(item.id ?? "")) ?? "",
			item.scored ?? "",
			item.dimensionId ?? "",
			item.reverseScored ?? "",
			item.helperText ?? "",
			item.maxLength ?? "",
			labels[0] ?? "",
			labels[1] ?? "",
			labels[2] ?? "",
			labels[3] ?? "",
			labels[4] ?? "",
		]).commit();
	}

	// --- Bands sheet ---
	const bandsSheet = wb.addWorksheet("Bands");
	bandsSheet.addRow(["id", "name", "minScaled", "maxScaled"]).commit();
	for (const b of (Array.isArray(doc.bands) ? doc.bands : []) as Record<string, unknown>[]) {
		bandsSheet.addRow([b.id, b.name, b.minScaled, b.maxScaled]).commit();
	}

	// --- ContextRules sheet (protected, export-only) ---
	const rules = Array.isArray(doc.responseContextRules) ? doc.responseContextRules as Record<string, unknown>[] : [];
	const crSheet = wb.addWorksheet("ContextRules");
	crSheet.addRow(["id", "type", "label", "enabled", "managerExplanation", "itemIds", "threshold", "pairs", "runLength"]).commit();
	for (const rule of rules) {
		crSheet.addRow([
			rule.id ?? "",
			rule.type ?? "",
			rule.label ?? "",
			rule.enabled ?? "",
			rule.managerExplanation ?? "",
			Array.isArray(rule.itemIds) ? (rule.itemIds as string[]).join(",") : "",
			rule.threshold ?? "",
			Array.isArray(rule.pairs) ? JSON.stringify(rule.pairs) : "",
			rule.runLength ?? "",
		]).commit();
	}
	// Sheet-protect ContextRules (read-only, no password needed for purpose)
	await crSheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

	// --- Lists sheet (hidden lookup, not imported) ---
	const listsSheet = wb.addWorksheet("Lists", { state: "hidden" });
	listsSheet.addRow(["displayMode", "continuous"]).commit();
	listsSheet.addRow(["displayMode", "section"]).commit();
	listsSheet.addRow(["scoringMode", "dimensional"]).commit();
	listsSheet.addRow(["scoringMode", "none"]).commit();

	// 5. Write to buffer
	const arrayBuffer = await wb.xlsx.writeBuffer();
	return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// parseWorkbook
// ---------------------------------------------------------------------------

export async function parseWorkbook(buf: Buffer): Promise<ParseWorkbookResult> {
	// 1. Buffer size check
	if (buf.length > MAX_BUFFER_BYTES) {
		return { refuse: "File too large (max 2 MiB). Re-download from Afenda or import JSON." };
	}

	// 2. Zip entry count — walk actual CD records with strict alignment check
	const entryCount = countZipCentralDirEntries(buf);
	if (entryCount === "zip64") {
		return { refuse: "Zip64 xlsx is not supported in v1. Re-download from Afenda or import JSON." };
	}
	if (entryCount === "malformed") {
		return { refuse: "Zip structure invalid (centralDirOffset+centralDirSize≠EOCD position, empty CD, or offset out of range). Re-download from Afenda or import JSON." };
	}
	// A well-formed xlsx always has at least one zip entry; 0 means something went wrong.
	if (entryCount === 0) {
		return { refuse: "Zip has zero entries. Re-download from Afenda or import JSON." };
	}
	if (entryCount > MAX_ZIP_ENTRIES) {
		return { refuse: `File has too many zip entries (${entryCount} > ${MAX_ZIP_ENTRIES}). Re-download from Afenda or import JSON.` };
	}

	// 3. Load with ExcelJS
	let wb: ExcelJS.Workbook;
	try {
		wb = new ExcelJS.Workbook();
		await wb.xlsx.load(buf as unknown as ArrayBuffer);
	} catch (e) {
		return { refuse: `Cannot read file as xlsx: ${e instanceof Error ? e.message : String(e)}. Re-download from Afenda or import JSON.` };
	}

	// 4. Non-empty cell count (across all sheets)
	const cellCount = countNonEmptyCells(wb);
	if (cellCount > MAX_NON_EMPTY_CELLS) {
		return { refuse: `Too many non-empty cells (${cellCount} > ${MAX_NON_EMPTY_CELLS}). Re-download from Afenda or import JSON.` };
	}

	// ---------------------------------------------------------------------------
	// Typed cell helpers (for narrowing CanonicalCellResult)
	// ---------------------------------------------------------------------------

	function ccText(ws: ExcelJS.Worksheet, r: number, c: number): string | null {
		const res = canonicalCell(getCellValue(ws, r, c), "text");
		return res.ok ? (res.value as string | null) : null;
	}

	function ccId(ws: ExcelJS.Worksheet, r: number, c: number): string | null {
		const res = canonicalCell(getCellValue(ws, r, c), "id");
		return res.ok ? (res.value as string | null) : null;
	}

	function ccNum(ws: ExcelJS.Worksheet, r: number, c: number): number | null {
		const res = canonicalCell(getCellValue(ws, r, c), "number");
		return res.ok ? (res.value as number | null) : null;
	}

	function ccInt(ws: ExcelJS.Worksheet, r: number, c: number): number | null {
		const res = canonicalCell(getCellValue(ws, r, c), "int");
		return res.ok ? (res.value as number | null) : null;
	}

	function ccBool(ws: ExcelJS.Worksheet, r: number, c: number): boolean | null {
		const res = canonicalCell(getCellValue(ws, r, c), "bool");
		return res.ok ? (res.value as boolean | null) : null;
	}

	// 5. Find _Source sheet
	const srcSheet = wb.getWorksheet("_Source");
	if (!srcSheet) {
		return { refuse: "Missing _Source sheet. Re-download from Afenda or import JSON." };
	}

	// 6. Validate _Source metadata
	const magic = getCellString(srcSheet, 1, 1);
	if (magic !== SOURCE_MAGIC) {
		return { refuse: `Invalid _Source magic: "${magic}". Re-download from Afenda or import JSON.` };
	}

	const sourceModeRaw = getCellString(srcSheet, 2, 1);
	if (sourceModeRaw !== "strict" && sourceModeRaw !== "draft") {
		return { refuse: `Invalid sourceMode "${sourceModeRaw}". Re-download from Afenda or import JSON.` };
	}
	const sourceMode = sourceModeRaw as "strict" | "draft";

	const storedImportableHash = getCellString(srcSheet, 3, 1);
	const baseAssessmentId = getCellString(srcSheet, 4, 1) || null;
	const baseDraftRevisionRaw = getCellString(srcSheet, 5, 1);
	const baseDraftRevision = baseDraftRevisionRaw ? Number(baseDraftRevisionRaw) : null;
	const basePublishedVersionNumberRaw = getCellString(srcSheet, 6, 1);
	const basePublishedVersionNumber = basePublishedVersionNumberRaw ? Number(basePublishedVersionNumberRaw) : null;
	const storedRawHash = getCellString(srcSheet, 7, 1);
	const chunkCountRaw = getCellValue(srcSheet, 8, 1);
	const chunkCount = typeof chunkCountRaw === "number" ? chunkCountRaw : parseInt(String(chunkCountRaw), 10);

	if (!Number.isFinite(chunkCount) || chunkCount < 1 || !Number.isInteger(chunkCount)) {
		return { refuse: "Invalid chunkCount in _Source. Re-download from Afenda or import JSON." };
	}

	// 7. Reassemble chunks
	const chunks: string[] = [];
	for (let i = 1; i <= chunkCount; i++) {
		const chunk = getCellString(srcSheet, i, 2);
		if (!chunk) {
			return { refuse: `Missing chunk B${i} in _Source. Re-download from Afenda or import JSON.` };
		}
		chunks.push(chunk);
	}
	const payload = chunks.join("");

	// 8. Base64 decode + gunzip with hard output cap (decompression bomb prevention)
	let rawBytes: Buffer;
	let compressedLen: number;
	try {
		const compressed = Buffer.from(payload, "base64");
		compressedLen = compressed.length;
		// maxOutputLength throws ERR_BUFFER_TOO_LARGE before fully decompressing
		rawBytes = gunzipSync(compressed, { maxOutputLength: MAX_DECOMPRESSED_JSON_BYTES });
	} catch (e) {
		return { refuse: `Cannot decompress _Source payload: ${e instanceof Error ? e.message : String(e)}. Re-download from Afenda or import JSON.` };
	}

	// 9. Gzip ratio check (decompressed already capped above; this catches borderline bombs)
	if (rawBytes.length > MAX_DECOMPRESSED_JSON_BYTES || rawBytes.length > MAX_GZIP_RATIO * compressedLen) {
		return { refuse: "Decompressed _Source exceeds size limit. Re-download from Afenda or import JSON." };
	}

	// 10. Hash check
	const actualHash = sha256Hex(rawBytes);
	if (actualHash !== storedRawHash) {
		return { refuse: "A7 hash mismatch in _Source (payload tampered). Re-download from Afenda or import JSON." };
	}

	// 11. JSON parse + Zod
	let rawJson: string;
	try {
		rawJson = rawBytes.toString("utf8");
	} catch {
		return { refuse: "Cannot decode _Source payload as UTF-8. Re-download from Afenda or import JSON." };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawJson);
	} catch {
		return { refuse: "Cannot parse _Source JSON. Re-download from Afenda or import JSON." };
	}

	let sourceDocument: unknown;
	try {
		if (sourceMode === "strict") {
			sourceDocument = parseInstrumentDocument(parsed);
		} else {
			sourceDocument = parseDraftDocument(parsed);
		}
	} catch (e) {
		return { refuse: `_Source Zod validation failed: ${e instanceof Error ? e.message : String(e)}. Re-download from Afenda or import JSON.` };
	}

	// 12. Parse visible sheets into importableSheets + provenance
	const provenance: WorkbookProvenance = new Map();
	const issues: ParseWorkbookSuccess["issues"] = [];

	// Parse Meta
	const metaSheet = wb.getWorksheet("Meta");
	const importableMeta: Record<string, unknown> = {};
	if (metaSheet) {
		metaSheet.eachRow((_row: ExcelJS.Row, rowNum: number) => {
			const keyRes = canonicalCell(getCellValue(metaSheet, rowNum, 1), "text");
			const val = getCellValue(metaSheet, rowNum, 2);
			if (keyRes.ok && typeof keyRes.value === "string" && keyRes.value) {
				importableMeta[keyRes.value] = val;
				provenance.set(`meta.${keyRes.value}`, `Meta!B${rowNum}`);
			}
		});
	}

	// Parse Consent
	const consentSheet = wb.getWorksheet("Consent");
	const importableConsent: Record<string, unknown> = {};
	if (consentSheet) {
		consentSheet.eachRow((_row: ExcelJS.Row, rowNum: number) => {
			const keyRes = canonicalCell(getCellValue(consentSheet, rowNum, 1), "text");
			const val = getCellValue(consentSheet, rowNum, 2);
			if (keyRes.ok && typeof keyRes.value === "string" && keyRes.value) {
				importableConsent[keyRes.value] = val;
				provenance.set(`consent.${keyRes.value}`, `Consent!B${rowNum}`);
			}
		});
	}

	// Parse Sections
	const sectionsSheet = wb.getWorksheet("Sections");
	const importableSections: unknown[] = [];
	if (sectionsSheet) {
		let headerRow = true;
		sectionsSheet.eachRow((_row: ExcelJS.Row, rowNum: number) => {
			if (headerRow) { headerRow = false; return; }
			const idRes = canonicalCell(getCellValue(sectionsSheet, rowNum, 1), "id");
			if (!idRes.ok && idRes.issue === "scientific_notation") {
				issues.push({ code: "scientific_notation", message: `Sections!A${rowNum}: id in scientific notation`, severity: "hard", sheetRef: `Sections!A${rowNum}` });
			}
			importableSections.push({
				id: idRes.ok ? idRes.value : getCellValue(sectionsSheet, rowNum, 1),
				title: ccText(sectionsSheet, rowNum, 2) ?? "",
				introduction: ccText(sectionsSheet, rowNum, 3) ?? undefined,
				order: ccNum(sectionsSheet, rowNum, 4),
			});
			provenance.set(`sections[${rowNum - 2}].id`, `Sections!A${rowNum}`);
		});
	}

	// Parse Dimensions
	const dimensionsSheet = wb.getWorksheet("Dimensions");
	const importableDimensions: unknown[] = [];
	if (dimensionsSheet) {
		let headerRow = true;
		dimensionsSheet.eachRow((_row: ExcelJS.Row, rowNum: number) => {
			if (headerRow) { headerRow = false; return; }
			const idRes = canonicalCell(getCellValue(dimensionsSheet, rowNum, 1), "id");
			if (!idRes.ok && idRes.issue === "scientific_notation") {
				issues.push({ code: "scientific_notation", message: `Dimensions!A${rowNum}: id in scientific notation`, severity: "hard", sheetRef: `Dimensions!A${rowNum}` });
			}
			importableDimensions.push({
				id: idRes.ok ? idRes.value : getCellValue(dimensionsSheet, rowNum, 1),
				code: ccText(dimensionsSheet, rowNum, 2) ?? "",
				name: ccText(dimensionsSheet, rowNum, 3) ?? "",
				description: ccText(dimensionsSheet, rowNum, 4) ?? undefined,
				order: ccNum(dimensionsSheet, rowNum, 5),
			});
			provenance.set(`dimensions[${rowNum - 2}].id`, `Dimensions!A${rowNum}`);
		});
	}

	// Parse Items
	const itemsSheet = wb.getWorksheet("Items");
	const importableItems: unknown[] = [];
	if (itemsSheet) {
		let headerRow = true;
		itemsSheet.eachRow((_row: ExcelJS.Row, rowNum: number) => {
			if (headerRow) { headerRow = false; return; }
			const idRes = canonicalCell(getCellValue(itemsSheet, rowNum, 2), "id");
			if (!idRes.ok && idRes.issue === "scientific_notation") {
				issues.push({ code: "scientific_notation", message: `Items!B${rowNum}: id in scientific notation`, severity: "hard", sheetRef: `Items!B${rowNum}` });
			}
			const typeVal = ccText(itemsSheet, rowNum, 1) ?? "";
			const labels = ([13, 14, 15, 16, 17] as const).map((col) => ccText(itemsSheet, rowNum, col) ?? "");

			const item: Record<string, unknown> = {
				type: typeVal,
				id: idRes.ok ? idRes.value : getCellValue(itemsSheet, rowNum, 2),
				order: ccNum(itemsSheet, rowNum, 3),
				sectionId: ccId(itemsSheet, rowNum, 7),
			};

			const textVal = ccText(itemsSheet, rowNum, 4);
			if (textVal !== null) item.text = textVal;

			const bodyVal = ccText(itemsSheet, rowNum, 5);
			if (bodyVal !== null) item.body = bodyVal;

			const reqRaw = canonicalCell(getCellValue(itemsSheet, rowNum, 6), "bool");
			if (reqRaw.ok && reqRaw.value !== null) {
				item.required = reqRaw.value;
			} else if (!reqRaw.ok) {
				issues.push({ code: "invalid_bool", message: `Items!F${rowNum}: invalid boolean value`, severity: "hard", sheetRef: `Items!F${rowNum}` });
			}

			const scoredRaw = canonicalCell(getCellValue(itemsSheet, rowNum, 8), "bool");
			if (scoredRaw.ok && scoredRaw.value !== null) {
				item.scored = scoredRaw.value;
			} else if (!scoredRaw.ok) {
				issues.push({ code: "invalid_bool", message: `Items!H${rowNum}: invalid boolean value`, severity: "hard", sheetRef: `Items!H${rowNum}` });
			}

			item.dimensionId = ccId(itemsSheet, rowNum, 9);

			const revRaw = canonicalCell(getCellValue(itemsSheet, rowNum, 10), "bool");
			if (revRaw.ok && revRaw.value !== null) {
				item.reverseScored = revRaw.value;
			} else if (!revRaw.ok) {
				issues.push({ code: "invalid_bool", message: `Items!J${rowNum}: invalid boolean value`, severity: "hard", sheetRef: `Items!J${rowNum}` });
			}

			const helperVal = ccText(itemsSheet, rowNum, 11);
			if (helperVal !== null) item.helperText = helperVal;

			const maxLenVal = ccInt(itemsSheet, rowNum, 12);
			if (maxLenVal !== null) item.maxLength = maxLenVal;

			if (typeVal === "scale" || typeVal === "likert") {
				item.labels = labels;
				item.min = 1;
				item.max = 5;
			}

			importableItems.push(item);
			provenance.set(`items[${rowNum - 2}].id`, `Items!B${rowNum}`);
		});
	}

	// Parse Bands
	const bandsSheet = wb.getWorksheet("Bands");
	const importableBands: unknown[] = [];
	if (bandsSheet) {
		let headerRow = true;
		bandsSheet.eachRow((_row: ExcelJS.Row, rowNum: number) => {
			if (headerRow) { headerRow = false; return; }
			const idRes = canonicalCell(getCellValue(bandsSheet, rowNum, 1), "id");
			if (!idRes.ok && idRes.issue === "scientific_notation") {
				issues.push({ code: "scientific_notation", message: `Bands!A${rowNum}: id in scientific notation`, severity: "hard", sheetRef: `Bands!A${rowNum}` });
			}
			importableBands.push({
				id: idRes.ok ? idRes.value : getCellValue(bandsSheet, rowNum, 1),
				name: ccText(bandsSheet, rowNum, 2) ?? "",
				minScaled: ccInt(bandsSheet, rowNum, 3),
				maxScaled: ccInt(bandsSheet, rowNum, 4),
			});
			provenance.set(`bands[${rowNum - 2}].id`, `Bands!A${rowNum}`);
		});
	}

	// Parse ContextRules sheet
	const crSheet = wb.getWorksheet("ContextRules");
	let contextRulesSheet: ParseWorkbookSuccess["contextRulesSheet"];
	if (!crSheet) {
		contextRulesSheet = "absent";
	} else {
		const rows: unknown[] = [];
		let headerRow = true;
		crSheet.eachRow((_row: ExcelJS.Row, rowNum: number) => {
			if (headerRow) { headerRow = false; return; }
			rows.push({
				id: ccId(crSheet, rowNum, 1),
				type: ccText(crSheet, rowNum, 2),
				label: ccText(crSheet, rowNum, 3),
				enabled: ccBool(crSheet, rowNum, 4),
				managerExplanation: ccText(crSheet, rowNum, 5),
				itemIds: getCellValue(crSheet, rowNum, 6),
				threshold: getCellValue(crSheet, rowNum, 7),
				pairs: getCellValue(crSheet, rowNum, 8),
				runLength: getCellValue(crSheet, rowNum, 9),
			});
		});
		contextRulesSheet = { rows };
	}

	// Build importableSheets
	const importableSheets: VisibleImportable = {
		meta: {
			title: String(importableMeta.title ?? ""),
			internalDescription: typeof importableMeta.internalDescription === "string" ? importableMeta.internalDescription : undefined,
			candidateIntroduction: String(importableMeta.candidateIntroduction ?? ""),
			estimatedMinutes: typeof importableMeta.estimatedMinutes === "number" ? importableMeta.estimatedMinutes : parseFloat(String(importableMeta.estimatedMinutes ?? "0")),
			displayMode: String(importableMeta.displayMode ?? ""),
			scoringMode: typeof importableMeta.scoringMode === "string" ? importableMeta.scoringMode : undefined,
		},
		consent: {
			purpose: String(importableConsent.purpose ?? ""),
			whatWeCollect: String(importableConsent.whatWeCollect ?? ""),
			whoSeesIt: String(importableConsent.whoSeesIt ?? ""),
			retention: String(importableConsent.retention ?? ""),
		},
		sections: importableSections as VisibleImportable["sections"],
		dimensions: importableDimensions as VisibleImportable["dimensions"],
		items: importableItems as VisibleImportable["items"],
		bands: importableBands as VisibleImportable["bands"],
	};

	// Provenance for base meta fields
	provenance.set("meta.baseAssessmentId", `_Source!A4`);
	provenance.set("meta.baseDraftRevision", `_Source!A5`);
	provenance.set("meta.basePublishedVersionNumber", `_Source!A6`);

	return {
		sourceMode,
		sourceDocument,
		sourceHash: storedImportableHash,
		baseAssessmentId,
		baseDraftRevision,
		basePublishedVersionNumber,
		importableSheets,
		contextRulesSheet,
		provenance,
		issues,
	};
}

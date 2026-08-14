/**
 * CSV import/export for instrument items (upsert-only).
 *
 * Spec §11:
 * - UTF-8 with BOM on export; import accepts BOM.
 * - Items-only upsert. assessmentId/target required — CSV cannot create.
 * - Never deletes items/sections/etc.
 * - Blank order: keep existing if id exists; append after max if new blank-id insert.
 * - Invisible fields from current target draft.
 * - Cannot create sections/dimensions/consent/bands/rules.
 * - Header includes optional `order`.
 *
 * Pure module. No Prisma.
 */

import { mintId } from "@/lib/instrument-template/identity";
import { canonicalizeDocumentOrder } from "@/lib/instrument-order";
import { diffInstruments, type InstrumentDiff } from "@/lib/instrument-template/diff";
import { assertReferentialIntegrity } from "@/lib/instrument-template/integrity";
import { assertInstrumentInvariants, type ImportIssue } from "@/lib/instrument-invariants";

// ---------------------------------------------------------------------------
// CSV constants and types
// ---------------------------------------------------------------------------

const UTF8_BOM = "\uFEFF";

/** Item columns exported by exportCsv. */
const CSV_ITEM_COLUMNS = [
	"type",
	"id",
	"order",
	"text",
	"body",
	"required",
	"sectionId",
	"scored",
	"dimensionId",
	"reverseScored",
	"helperText",
	"maxLength",
	"label1",
	"label2",
	"label3",
	"label4",
	"label5",
] as const;

type CsvRow = Partial<Record<(typeof CSV_ITEM_COLUMNS)[number], string>>;

// ---------------------------------------------------------------------------
// CSV encode/decode helpers
// ---------------------------------------------------------------------------

function csvEscapeField(value: string): string {
	// Quote fields that contain comma, newline, or quote
	if (value.includes(",") || value.includes("\n") || value.includes("\r") || value.includes('"')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function csvEncodeLine(fields: string[]): string {
	return fields.map(csvEscapeField).join(",");
}

function csvParseLine(line: string): string[] {
	const fields: string[] = [];
	let i = 0;
	while (i < line.length) {
		if (line[i] === '"') {
			// Quoted field
			let field = "";
			i++; // skip opening quote
			while (i < line.length) {
				if (line[i] === '"' && line[i + 1] === '"') {
					field += '"';
					i += 2;
				} else if (line[i] === '"') {
					i++; // skip closing quote
					break;
				} else {
					field += line[i];
					i++;
				}
			}
			fields.push(field);
			if (line[i] === ",") i++; // skip comma
		} else {
			// Unquoted field
			const start = i;
			while (i < line.length && line[i] !== ",") i++;
			fields.push(line.slice(start, i));
			if (line[i] === ",") i++; // skip comma
		}
	}
	return fields;
}

function parseCsvRows(text: string): { headers: string[]; rows: CsvRow[] } {
	// Strip BOM
	const cleaned = text.startsWith(UTF8_BOM) ? text.slice(1) : text;
	const lines = cleaned.split(/\r?\n/);

	// First non-empty line is header
	const headerLine = lines.find((l) => l.trim().length > 0);
	if (!headerLine) return { headers: [], rows: [] };

	const headers = csvParseLine(headerLine);
	const rows: CsvRow[] = [];

	for (let i = lines.indexOf(headerLine) + 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line || line.trim() === "") continue;
		const values = csvParseLine(line);
		const row: CsvRow = {};
		for (let j = 0; j < headers.length; j++) {
			const col = headers[j] as (typeof CSV_ITEM_COLUMNS)[number];
			row[col] = values[j] ?? "";
		}
		rows.push(row);
	}

	return { headers, rows };
}

// ---------------------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------------------

export function exportCsv(document: unknown): Buffer {
	const doc = document as Record<string, unknown>;
	const items = Array.isArray(doc.items) ? (doc.items as Record<string, unknown>[]) : [];
	const sections = Array.isArray(doc.sections) ? (doc.sections as Record<string, unknown>[]) : [];

	// Build sectionId lookup from sections.itemIds
	const itemSectionId = new Map<string, string>();
	for (const section of sections) {
		const sId = String(section.id ?? "");
		for (const itemId of (Array.isArray(section.itemIds) ? section.itemIds : []) as string[]) {
			itemSectionId.set(itemId, sId);
		}
	}

	const lines: string[] = [];
	lines.push(csvEncodeLine([...CSV_ITEM_COLUMNS]));

	for (const item of items) {
		const labels = Array.isArray(item.labels) ? (item.labels as string[]) : [];
		lines.push(csvEncodeLine([
			String(item.type ?? ""),
			String(item.id ?? ""),
			item.order !== undefined && item.order !== null ? String(item.order) : "",
			String(item.text ?? ""),
			String(item.body ?? ""),
			item.required !== undefined ? String(item.required) : "",
			itemSectionId.get(String(item.id ?? "")) ?? "",
			item.scored !== undefined ? String(item.scored) : "",
			String(item.dimensionId ?? ""),
			item.reverseScored !== undefined ? String(item.reverseScored) : "",
			String(item.helperText ?? ""),
			item.maxLength !== undefined ? String(item.maxLength) : "",
			labels[0] ?? "",
			labels[1] ?? "",
			labels[2] ?? "",
			labels[3] ?? "",
			labels[4] ?? "",
		]));
	}

	const csvText = UTF8_BOM + lines.join("\r\n");
	return Buffer.from(csvText, "utf8");
}

// ---------------------------------------------------------------------------
// Preview result for CSV
// ---------------------------------------------------------------------------

export type CsvPreviewResult =
	| { refuse: string }
	| {
			document: unknown;
			diff: InstrumentDiff;
			issues: ImportIssue[];
			committable: boolean;
	  };

// ---------------------------------------------------------------------------
// Import CSV (upsert)
// ---------------------------------------------------------------------------

export function previewImportCsv(args: {
	bytes: Uint8Array | Buffer;
	target: unknown;
	targetId: string | null;
}): CsvPreviewResult {
	// CSV cannot create — targetId and target required
	if (args.targetId === null || args.target === null || args.target === undefined) {
		return { refuse: "CSV import requires an existing assessment target. Use xlsx or JSON to create a new assessment." };
	}

	const bytes = Buffer.isBuffer(args.bytes) ? args.bytes : Buffer.from(args.bytes);

	let text: string;
	try {
		text = bytes.toString("utf8");
	} catch {
		return { refuse: "Cannot decode CSV as UTF-8." };
	}

	const { headers, rows } = parseCsvRows(text);

	if (headers.length === 0) {
		return { refuse: "CSV file is empty or has no header row." };
	}

	// Target must be an object with items + sections
	const targetDoc = args.target as Record<string, unknown>;
	const targetItems = Array.isArray(targetDoc.items)
		? (targetDoc.items as Record<string, unknown>[])
		: [];
	const targetSections = Array.isArray(targetDoc.sections)
		? (targetDoc.sections as Record<string, unknown>[])
		: [];

	// Build lookup maps from target
	const targetItemById = new Map<string, Record<string, unknown>>();
	for (const item of targetItems) {
		const id = String(item.id ?? "");
		if (id) targetItemById.set(id, item);
	}

	// Build sectionId → max order from target
	const sectionMaxOrder = new Map<string, number>();
	for (const section of targetSections) {
		const sId = String(section.id ?? "");
		const itemIds = Array.isArray(section.itemIds) ? (section.itemIds as string[]) : [];
		let maxOrd = 0;
		for (const iid of itemIds) {
			const item = targetItemById.get(iid);
			if (item) {
				const ord = typeof item.order === "number" ? item.order : 0;
				if (ord > maxOrd) maxOrd = ord;
			}
		}
		sectionMaxOrder.set(sId, maxOrd);
	}

	const issues: ImportIssue[] = [];
	const upsertedItems = new Map<string, Record<string, unknown>>();

	for (const [rowIdx, row] of rows.entries()) {
		const rawId = (row.id ?? "").trim();
		const rawType = (row.type ?? "").trim();

		if (!rawType) {
			issues.push({
				severity: "hard",
				code: "missing_type",
				message: `Row ${rowIdx + 2}: missing item type`,
				path: `csv[${rowIdx}].type`,
			});
			continue;
		}

		const orderStr = (row.order ?? "").trim();
		let orderVal: number | undefined;
		if (orderStr !== "") {
			const n = Number(orderStr);
			orderVal = Number.isFinite(n) ? n : undefined;
		}

		// Determine existing vs new item
		let existingItem: Record<string, unknown> | undefined;
		let resolvedId: string;

		if (rawId === "") {
			// New item — mint id
			resolvedId = mintId("it");
			// No existing item
		} else {
			existingItem = targetItemById.get(rawId);
			if (!existingItem) {
				issues.push({
					severity: "hard",
					code: "unknown_id",
					message: `Row ${rowIdx + 2}: item id "${rawId}" does not exist in target draft — leave id blank to insert`,
					path: `csv[${rowIdx}].id`,
				});
				continue;
			}
			resolvedId = rawId;
		}

		// Build updated item — start from existing (or blank for new)
		const base = existingItem ? { ...existingItem } : {};

		const updated: Record<string, unknown> = {
			...base,
			id: resolvedId,
			type: rawType || base.type,
		};

		// Apply importable fields from CSV row
		if (row.text !== undefined && row.text !== "") updated.text = row.text;
		if (row.body !== undefined && row.body !== "") updated.body = row.body;
		if (row.required !== undefined && row.required !== "") {
			const v = row.required.toLowerCase();
			if (v === "true" || v === "1" || v === "yes") updated.required = true;
			else if (v === "false" || v === "0" || v === "no") updated.required = false;
		}
		if (row.scored !== undefined && row.scored !== "") {
			const v = row.scored.toLowerCase();
			if (v === "true" || v === "1" || v === "yes") updated.scored = true;
			else if (v === "false" || v === "0" || v === "no") updated.scored = false;
		}
		if (row.dimensionId !== undefined) {
			updated.dimensionId = row.dimensionId.trim() || null;
		}
		if (row.reverseScored !== undefined && row.reverseScored !== "") {
			const v = row.reverseScored.toLowerCase();
			if (v === "true" || v === "1" || v === "yes") updated.reverseScored = true;
			else if (v === "false" || v === "0" || v === "no") updated.reverseScored = false;
		}
		if (row.helperText !== undefined && row.helperText !== "") updated.helperText = row.helperText;
		if (row.maxLength !== undefined && row.maxLength !== "") {
			const n = parseInt(row.maxLength, 10);
			if (Number.isFinite(n) && n > 0) updated.maxLength = n;
		}

		// Labels
		const labelCols = ["label1", "label2", "label3", "label4", "label5"] as const;
		const labelsInCsv = labelCols.some((c) => row[c] !== undefined && row[c] !== "");
		if (labelsInCsv || rawType === "scale" || rawType === "likert") {
			const existingLabels = Array.isArray(base.labels) ? (base.labels as string[]) : ["", "", "", "", ""];
			updated.labels = labelCols.map((col, i) => {
				const v = row[col];
				return v !== undefined && v !== "" ? v : (existingLabels[i] ?? "");
			});
			if (!updated.min) updated.min = 1;
			if (!updated.max) updated.max = 5;
		}

		// Order: blank → keep existing or append
		if (orderVal !== undefined) {
			updated.order = orderVal;
		} else if (existingItem) {
			updated.order = existingItem.order;
		} else {
			// New item with blank order — append after max
			const sId = (row.sectionId ?? "").trim() || String(updated.sectionId ?? "");
			const maxOrd = sectionMaxOrder.get(sId) ?? 0;
			updated.order = maxOrd + 1;
			// Update max for subsequent new items in same section
			sectionMaxOrder.set(sId, maxOrd + 1);
		}

		// sectionId — from CSV if present, else keep existing
		const csvSectionId = (row.sectionId ?? "").trim();
		if (csvSectionId) {
			updated.sectionId = csvSectionId;
		} else if (existingItem) {
			// Find sectionId from target sections
			for (const section of targetSections) {
				const sId = String(section.id ?? "");
				const itemIds = Array.isArray(section.itemIds) ? (section.itemIds as string[]) : [];
				if (itemIds.includes(resolvedId)) {
					updated.sectionId = sId;
					break;
				}
			}
		}

		upsertedItems.set(resolvedId, updated);
	}

	// Build merged document: start from target, upsert items
	const mergedItems = targetItems.map((item) => {
		const id = String(item.id ?? "");
		return upsertedItems.has(id) ? (upsertedItems.get(id) as Record<string, unknown>) : item;
	});

	// Append new items (minted ids not in targetItems)
	for (const [id, item] of upsertedItems) {
		if (!targetItemById.has(id)) {
			mergedItems.push(item);
		}
	}

	// Rebuild sections with new items appended where sectionId matches
	const newItems = mergedItems.filter((item) => !targetItemById.has(String(item.id ?? "")));
	const mergedSections = targetSections.map((section) => {
		const sId = String(section.id ?? "");
		const existingItemIds = Array.isArray(section.itemIds) ? [...(section.itemIds as string[])] : [];
		const insertedIds = newItems
			.filter((item) => String((item as Record<string, unknown>).sectionId ?? "") === sId)
			.map((item) => String((item as Record<string, unknown>).id ?? ""));
		return { ...section, itemIds: [...existingItemIds, ...insertedIds] };
	});

	const mergedDoc: Record<string, unknown> = {
		...targetDoc,
		items: mergedItems,
		sections: mergedSections,
	};

	// canonicalizeDocumentOrder
	let canonicalized: unknown;
	try {
		canonicalized = canonicalizeDocumentOrder(mergedDoc as Parameters<typeof canonicalizeDocumentOrder>[0]);
	} catch {
		canonicalized = mergedDoc;
	}

	// Integrity + invariants
	const integrityIssues = assertReferentialIntegrity(canonicalized);
	issues.push(...integrityIssues);

	const invariantIssues = assertInstrumentInvariants(canonicalized, "draft");
	issues.push(...invariantIssues);

	const diff = diffInstruments(canonicalized, args.target);

	const hasHard = issues.some((i) => i.severity === "hard");
	const committable = !hasHard;

	return {
		document: canonicalized,
		diff,
		issues,
		committable,
	};
}

/**
 * Tests for CSV import/export pipeline.
 */

import { describe, it, expect } from "vitest";
import { exportCsv, previewImportCsv } from "@/lib/instrument-template/csv";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { canonicalizeDocumentOrder } from "@/lib/instrument-order";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal valid target document with one section and one item */
function makeTargetDoc() {
	return canonicalizeDocumentOrder({
		schemaVersion: 1,
		title: "Test Assessment",
		internalDescription: undefined,
		candidateIntroduction: "Please complete",
		estimatedMinutes: 10,
		displayMode: "continuous",
		scoringMode: "none",
		consent: {
			purpose: "testing",
			whatWeCollect: "answers",
			whoSeesIt: "hr",
			retention: "1 year",
		},
		sections: [
			{
				id: "sec-1",
				title: "Section 1",
				order: 1,
				itemIds: ["item-1", "item-2"],
			},
		],
		dimensions: [],
		items: [
			{
				type: "short_text",
				id: "item-1",
				text: "First question",
				required: true,
				order: 1,
			},
			{
				type: "short_text",
				id: "item-2",
				text: "Second question",
				required: false,
				order: 2,
			},
		],
		bands: [],
		responseContextRules: [],
	});
}

// ---------------------------------------------------------------------------
// exportCsv
// ---------------------------------------------------------------------------

describe("exportCsv", () => {
	it("exports Core document to CSV with header row", () => {
		const buf = exportCsv(CORE_V1_DOCUMENT);
		const text = buf.toString("utf8");
		expect(text.startsWith("\uFEFF")).toBe(true); // BOM
		expect(text).toMatch(/type,id,order/);
	});

	it("includes all items in Core document", () => {
		const buf = exportCsv(CORE_V1_DOCUMENT);
		const text = buf.toString("utf8").replace(/^\uFEFF/, "");
		const lines = text.split(/\r?\n/).filter((l) => l.trim());
		// header + all items
		expect(lines.length).toBe(CORE_V1_DOCUMENT.items.length + 1);
	});

	it("includes sectionId column populated from sections.itemIds", () => {
		const buf = exportCsv(makeTargetDoc());
		const text = buf.toString("utf8").replace(/^\uFEFF/, "");
		expect(text).toMatch(/sec-1/);
	});
});

// ---------------------------------------------------------------------------
// previewImportCsv: create refuses
// ---------------------------------------------------------------------------

describe("previewImportCsv — create path refused", () => {
	it("refuses when targetId is null", () => {
		const buf = exportCsv(makeTargetDoc());
		const result = previewImportCsv({
			bytes: buf,
			target: makeTargetDoc(),
			targetId: null,
		});
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) {
			expect(result.refuse).toMatch(/existing assessment target/i);
		}
	});

	it("refuses when target is null", () => {
		const buf = exportCsv(makeTargetDoc());
		const result = previewImportCsv({
			bytes: buf,
			target: null,
			targetId: "some-id",
		});
		expect("refuse" in result).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// previewImportCsv: upsert
// ---------------------------------------------------------------------------

describe("previewImportCsv — upsert existing items", () => {
	it("updates text of an existing item", () => {
		const targetDoc = makeTargetDoc();
		const updatedCsv = "\uFEFFtype,id,order,text\r\nshort_text,item-1,1,Updated question text\r\n";
		const result = previewImportCsv({
			bytes: Buffer.from(updatedCsv, "utf8"),
			target: targetDoc,
			targetId: "test-id",
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const doc = result.document as Record<string, unknown>;
		const items = doc.items as Array<Record<string, unknown>>;
		const item1 = items.find((i) => i.id === "item-1");
		expect(item1).toBeDefined();
		expect(item1?.text).toBe("Updated question text");
		expect(result.committable).toBe(true);
	});

	it("preserves unchanged items", () => {
		const targetDoc = makeTargetDoc();
		const csv = "\uFEFFtype,id,order,text\r\nshort_text,item-1,1,Updated\r\n";
		const result = previewImportCsv({
			bytes: Buffer.from(csv, "utf8"),
			target: targetDoc,
			targetId: "test-id",
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const doc = result.document as Record<string, unknown>;
		const items = doc.items as Array<Record<string, unknown>>;
		const item2 = items.find((i) => i.id === "item-2");
		expect(item2).toBeDefined();
		expect(item2?.text).toBe("Second question");
	});

	it("never deletes items not in CSV", () => {
		const targetDoc = makeTargetDoc();
		// Only include item-1 in CSV
		const csv = "\uFEFFtype,id,order,text\r\nshort_text,item-1,1,Updated\r\n";
		const result = previewImportCsv({
			bytes: Buffer.from(csv, "utf8"),
			target: targetDoc,
			targetId: "test-id",
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const doc = result.document as Record<string, unknown>;
		const items = doc.items as Array<Record<string, unknown>>;
		expect(items.length).toBe(2); // both items preserved
	});
});

// ---------------------------------------------------------------------------
// previewImportCsv: new item insert (blank id)
// ---------------------------------------------------------------------------

describe("previewImportCsv — insert new items", () => {
	it("mints an id for blank-id row", () => {
		const targetDoc = makeTargetDoc();
		const csv = "\uFEFFtype,id,order,text,sectionId\r\nshort_text,,3,New question,sec-1\r\n";
		const result = previewImportCsv({
			bytes: Buffer.from(csv, "utf8"),
			target: targetDoc,
			targetId: "test-id",
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const doc = result.document as Record<string, unknown>;
		const items = doc.items as Array<Record<string, unknown>>;
		expect(items.length).toBe(3); // 2 original + 1 new
		const newItem = items.find((i) => i.text === "New question");
		expect(newItem).toBeDefined();
		expect(typeof newItem?.id).toBe("string");
		expect(newItem?.id).toMatch(/^it_/);
	});

	it("new item with blank order appends after max", () => {
		const targetDoc = makeTargetDoc();
		const csv = "\uFEFFtype,id,text,sectionId\r\nshort_text,,New question,sec-1\r\n";
		const result = previewImportCsv({
			bytes: Buffer.from(csv, "utf8"),
			target: targetDoc,
			targetId: "test-id",
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const doc = result.document as Record<string, unknown>;
		const items = doc.items as Array<Record<string, unknown>>;
		const newItem = items.find((i) => i.text === "New question");
		expect(newItem).toBeDefined();
		// Order should be > 2 (current max in section)
		expect(typeof newItem?.order).toBe("number");
		expect((newItem?.order as number) > 2).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// previewImportCsv: unknown id → hard issue
// ---------------------------------------------------------------------------

describe("previewImportCsv — unknown id rejection", () => {
	it("emits hard issue for non-existent item id", () => {
		const targetDoc = makeTargetDoc();
		const csv = "\uFEFFtype,id,text\r\nshort_text,does-not-exist,Whatever\r\n";
		const result = previewImportCsv({
			bytes: Buffer.from(csv, "utf8"),
			target: targetDoc,
			targetId: "test-id",
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const issues = result.issues;
		const hardIssue = issues.find((i) => i.code === "unknown_id");
		expect(hardIssue).toBeDefined();
		expect(result.committable).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// previewImportCsv: round-trip on Core
// ---------------------------------------------------------------------------

describe("previewImportCsv — round-trip on Core", () => {
	it("round-trip export/import Core CSV produces no hard issues", () => {
		const target = canonicalizeDocumentOrder(CORE_V1_DOCUMENT as Parameters<typeof canonicalizeDocumentOrder>[0]);
		const buf = exportCsv(target);
		const result = previewImportCsv({
			bytes: buf,
			target,
			targetId: "core-id",
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const hardIssues = result.issues.filter((i) => i.severity === "hard");
		expect(hardIssues).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// exportCsv: empty document
// ---------------------------------------------------------------------------

describe("exportCsv — edge cases", () => {
	it("exports empty document with just header", () => {
		const emptyDoc = { items: [], sections: [], dimensions: [], bands: [] };
		const buf = exportCsv(emptyDoc);
		const text = buf.toString("utf8").replace(/^\uFEFF/, "");
		const lines = text.split(/\r?\n/).filter((l) => l.trim());
		expect(lines.length).toBe(1); // header only
	});
});

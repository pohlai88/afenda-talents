/**
 * Tests for previewImport (xlsx and json paths).
 */

import { describe, it, expect } from "vitest";
import { previewImport } from "@/lib/instrument-template/merge";
import { exportWorkbook } from "@/lib/instrument-template/workbook";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { blankInstrumentDocument } from "@/lib/instrument-draft";
import { canonicalizeDocumentOrder } from "@/lib/instrument-order";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_BASE = {
	baseAssessmentId: null as string | null,
	baseDraftRevision: null as number | null,
	basePublishedVersionNumber: null as number | null,
};

async function exportCore(overrides: Partial<typeof EMPTY_BASE> = {}): Promise<Buffer> {
	return exportWorkbook(CORE_V1_DOCUMENT, {
		sourceMode: "strict",
		...EMPTY_BASE,
		...overrides,
	});
}

async function exportBlankDraft(): Promise<Buffer> {
	const doc = canonicalizeDocumentOrder(blankInstrumentDocument());
	return exportWorkbook(doc, {
		sourceMode: "draft",
		...EMPTY_BASE,
	});
}

// ---------------------------------------------------------------------------
// xlsx: create path
// ---------------------------------------------------------------------------

describe("previewImport xlsx — create path", () => {
	it("returns no hard issues and no refuse for Core document create", async () => {
		const buf = await exportCore();
		const result = await previewImport({
			format: "xlsx",
			bytes: buf,
			target: null,
			targetId: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const hardIssues = result.issues.filter((i) => i.severity === "hard");
		expect(hardIssues).toEqual([]);
		expect(result.committable).toBe(true);
	});

	it("blank draft round-trip on create path", async () => {
		const buf = await exportBlankDraft();
		const result = await previewImport({
			format: "xlsx",
			bytes: buf,
			target: null,
			targetId: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const hardIssues = result.issues.filter((i) => i.severity === "hard");
		expect(hardIssues).toEqual([]);
		expect(result.committable).toBe(true);
	});

	it("document is returned with matching items count", async () => {
		const buf = await exportCore();
		const result = await previewImport({
			format: "xlsx",
			bytes: buf,
			target: null,
			targetId: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const doc = result.document as Record<string, unknown>;
		expect(Array.isArray(doc.items)).toBe(true);
		expect((doc.items as unknown[]).length).toBe(CORE_V1_DOCUMENT.items.length);
	});
});

// ---------------------------------------------------------------------------
// xlsx: destination guard
// ---------------------------------------------------------------------------

describe("previewImport xlsx — destination guard", () => {
	it("refuses when workbook exported from another assessment and targetId is different", async () => {
		const buf = await exportCore({ baseAssessmentId: "some-other-assessment" });
		const result = await previewImport({
			format: "xlsx",
			bytes: buf,
			target: CORE_V1_DOCUMENT,
			targetId: "my-assessment-id",
			liveDraftRevision: 1,
			livePublishedVersionNumber: null,
		});

		expect("refuse" in result).toBe(true);
		if ("refuse" in result) {
			expect(result.refuse).toMatch(/exported from another assessment/i);
		}
	});

	it("accepts when baseAssessmentId matches targetId", async () => {
		const buf = await exportCore({ baseAssessmentId: "my-assessment-id" });
		const result = await previewImport({
			format: "xlsx",
			bytes: buf,
			target: CORE_V1_DOCUMENT,
			targetId: "my-assessment-id",
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});

		expect("refuse" in result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// xlsx: stale base
// ---------------------------------------------------------------------------

describe("previewImport xlsx — stale base", () => {
	it("emits stale_base issue when revisions differ", async () => {
		const buf = await exportCore({
			baseAssessmentId: "my-id",
			baseDraftRevision: 1,
			basePublishedVersionNumber: null,
		});
		const result = await previewImport({
			format: "xlsx",
			bytes: buf,
			target: CORE_V1_DOCUMENT,
			targetId: "my-id",
			liveDraftRevision: 5, // differs from exported 1
			livePublishedVersionNumber: null,
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const staleIssue = result.issues.find((i) => i.code === "stale_base");
		expect(staleIssue).toBeDefined();
		expect(result.committable).toBe(false);
		expect(result.diff.summary.staleBase).toBe(true);
	});

	it("no stale issue when revisions match", async () => {
		const buf = await exportCore({
			baseAssessmentId: "my-id",
			baseDraftRevision: 3,
			basePublishedVersionNumber: 2,
		});
		const result = await previewImport({
			format: "xlsx",
			bytes: buf,
			target: CORE_V1_DOCUMENT,
			targetId: "my-id",
			liveDraftRevision: 3,
			livePublishedVersionNumber: 2,
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const staleIssue = result.issues.find((i) => i.code === "stale_base");
		expect(staleIssue).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// xlsx: refuse on invalid bytes
// ---------------------------------------------------------------------------

describe("previewImport xlsx — bad bytes", () => {
	it("refuses on garbage bytes", async () => {
		const result = await previewImport({
			format: "xlsx",
			bytes: Buffer.from("not a real xlsx file"),
			target: null,
			targetId: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});
		expect("refuse" in result).toBe(true);
	});

	it("refuses on oversized file", async () => {
		const result = await previewImport({
			format: "xlsx",
			bytes: Buffer.alloc(3 * 1024 * 1024), // 3 MiB > 2 MiB limit
			target: null,
			targetId: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) {
			expect(result.refuse).toMatch(/too large/i);
		}
	});
});

// ---------------------------------------------------------------------------
// JSON format
// ---------------------------------------------------------------------------

describe("previewImport json", () => {
	it("accepts Core document as JSON on create path", async () => {
		const jsonBytes = Buffer.from(JSON.stringify(CORE_V1_DOCUMENT), "utf8");
		const result = await previewImport({
			format: "json",
			bytes: jsonBytes,
			target: null,
			targetId: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});

		expect("refuse" in result).toBe(false);
		if ("refuse" in result) return;

		const hardIssues = result.issues.filter((i) => i.severity === "hard");
		expect(hardIssues).toEqual([]);
		expect(result.committable).toBe(true);
	});

	it("refuses on invalid JSON", async () => {
		const result = await previewImport({
			format: "json",
			bytes: Buffer.from("{bad json", "utf8"),
			target: null,
			targetId: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});
		expect("refuse" in result).toBe(true);
	});

	it("refuses document with reserved afenda- key", async () => {
		const docWithReservedKey = {
			...CORE_V1_DOCUMENT,
			assessmentKey: "afenda-something",
		};
		const jsonBytes = Buffer.from(JSON.stringify(docWithReservedKey), "utf8");
		const result = await previewImport({
			format: "json",
			bytes: jsonBytes,
			target: null,
			targetId: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});
		expect("refuse" in result).toBe(true);
		if ("refuse" in result) {
			expect(result.refuse).toMatch(/reserved prefix/i);
		}
	});

	it("accepts JSON with BOM", async () => {
		const json = "\uFEFF" + JSON.stringify(CORE_V1_DOCUMENT);
		const result = await previewImport({
			format: "json",
			bytes: Buffer.from(json, "utf8"),
			target: null,
			targetId: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});
		expect("refuse" in result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// CSV format routing
// ---------------------------------------------------------------------------

describe("previewImport csv", () => {
	it("returns refuse for csv format (use csv.ts pipeline)", async () => {
		const result = await previewImport({
			format: "csv",
			bytes: Buffer.from("type,id\nscale,item-1\n", "utf8"),
			target: null,
			targetId: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});
		expect("refuse" in result).toBe(true);
	});
});

import { describe, expect, it } from "vitest";
import { formatIssue } from "@/lib/instrument-template/issues";
import type { ProvenanceMap } from "@/lib/instrument-template/issues";
import type { ImportIssue } from "@/lib/instrument-invariants";

// ---------------------------------------------------------------------------
// formatIssue
// ---------------------------------------------------------------------------

describe("formatIssue", () => {
	it("returns sheetRef when already set on the issue", () => {
		const issue: ImportIssue = {
			severity: "hard",
			code: "duplicate_id",
			message: "Dup",
			sheetRef: "Items!C5",
			path: "items[0].id",
		};
		const prov: ProvenanceMap = new Map([["items[0].id", "Items!F14"]]);
		expect(formatIssue(issue, prov)).toBe("Items!C5");
	});

	it("looks up provenance map when sheetRef is absent", () => {
		const issue: ImportIssue = {
			severity: "hard",
			code: "duplicate_id",
			message: "Dup",
			path: "items[5].id",
		};
		const prov: ProvenanceMap = new Map([["items[5].id", "Items!F14"]]);
		expect(formatIssue(issue, prov)).toBe("Items!F14");
	});

	it("falls back to issue.path when provenance has no entry", () => {
		const issue: ImportIssue = {
			severity: "hard",
			code: "invalid_id",
			message: "Bad",
			path: "items[2].id",
		};
		const prov: ProvenanceMap = new Map();
		expect(formatIssue(issue, prov)).toBe("items[2].id");
	});

	it("falls back to issue.code when path and provenance are both absent", () => {
		const issue: ImportIssue = {
			severity: "hard",
			code: "invalid_document",
			message: "Not an object",
		};
		const prov: ProvenanceMap = new Map();
		expect(formatIssue(issue, prov)).toBe("invalid_document");
	});

	it("handles a realistic Items!F14 provenance lookup", () => {
		const issue: ImportIssue = {
			severity: "hard",
			code: "scientific_notation",
			message: "Id is in scientific notation",
			path: "items[13].id",
		};
		// Row 13 (0-based) → sheet row 14 (1-based header offset handled by caller)
		const prov: ProvenanceMap = new Map([["items[13].id", "Items!F14"]]);
		expect(formatIssue(issue, prov)).toBe("Items!F14");
	});
});

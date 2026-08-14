import { describe, expect, it } from "vitest";
import salesPerformanceRaw from "../../data/Sales_Performance_Role_Positioning_Assessment.json";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { PRE_JOINING_2026_DOCUMENT } from "@/lib/pre-joining-2026-document";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import { assertInstrumentInvariants } from "@/lib/instrument-invariants";
import { collectPublishIssues, publishBlockers } from "@/lib/instrument-draft";
import { buildCandidateBlocks } from "@/lib/candidate-form";

/**
 * Documents shipped in the repository and seeded into a database. The seed calls
 * parseInstrumentDocument on these, so a malformed one breaks `pnpm db:seed`
 * rather than a test — unless this catches it first.
 */
const SHIPPED: Array<[string, unknown]> = [
	["core-v1", CORE_V1_DOCUMENT],
	["pre-joining-2026", PRE_JOINING_2026_DOCUMENT],
	["sales-performance-role-positioning", salesPerformanceRaw],
];

describe.each(SHIPPED)("shipped document: %s", (_label, raw) => {
	const doc = parseInstrumentDocument(raw);

	it("passes publish-mode invariants", () => {
		expect(assertInstrumentInvariants(doc, "publish")).toEqual([]);
	});

	it("has no publish blockers", () => {
		expect(publishBlockers(collectPublishIssues(doc))).toEqual([]);
	});

	it("reaches the candidate form without dropping an answerable item", () => {
		const answerable = doc.items.filter((i) => i.type !== "info").length;
		const blocks = buildCandidateBlocks(doc);
		expect(blocks.filter((b) => b.kind === "item").length).toBe(answerable);
	});
});

describe("sales performance document", () => {
	const doc = parseInstrumentDocument(salesPerformanceRaw);

	it("normalises its legacy likert items to scale", () => {
		// The shipped file still uses `type: "likert"`; publish speaks "scale".
		const rawTypes = new Set(
			(salesPerformanceRaw as { items: Array<{ type: string }> }).items.map((i) => i.type),
		);
		expect(rawTypes.has("likert")).toBe(true);
		// Cast: the parsed type no longer includes "likert", which is exactly the
		// property under test — the assertion is about runtime data, not the type.
		expect(doc.items.some((i) => (i.type as string) === "likert")).toBe(false);
		expect(doc.items.some((i) => i.type === "scale")).toBe(true);
	});

	it("carries its own dimensions and bands rather than Core v1's", () => {
		expect(doc.dimensions.length).toBe(12);
		expect(doc.bands.length).toBe(5);
	});
});

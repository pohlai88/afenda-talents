import { describe, it, expect } from "vitest";
import { assertInstrumentInvariants } from "@/lib/instrument-invariants";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { PRE_JOINING_2026_DOCUMENT } from "@/lib/pre-joining-2026-document";
import type { InstrumentDocument } from "@/lib/instrument-document";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal valid dimensional document with n=2 scored items per dimension and
 * a band covering 40–44, which is unreachable at n=2.
 * reachableScaledValues(2) = [0, 13, 25, 38, 50, 63, 75, 88, 100]
 * No value lands in [40, 44] so this band is unreachable.
 */
const docWithN2AndBand4044: InstrumentDocument = {
	schemaVersion: 1,
	title: "Test n=2",
	candidateIntroduction: "intro",
	consent: {
		purpose: "p",
		whatWeCollect: "w",
		whoSeesIt: "s",
		retention: "r",
	},
	estimatedMinutes: 10,
	displayMode: "continuous",
	scoringMode: "dimensional",
	dimensions: [
		{ id: "dim-1", code: "D1", name: "Dimension 1", order: 0 },
	],
	bands: [
		{ id: "band-low", name: "Low", minScaled: 0, maxScaled: 39 },
		{ id: "band-gap", name: "Gap", minScaled: 40, maxScaled: 44 },
		{ id: "band-mid", name: "Mid", minScaled: 45, maxScaled: 100 },
	],
	sections: [
		{
			id: "sec-1",
			title: "Section 1",
			order: 0,
			itemIds: ["item-1", "item-2"],
		},
	],
	items: [
		{
			type: "scale",
			id: "item-1",
			text: "Item 1",
			required: true,
			min: 1,
			max: 5,
			labels: ["L1", "L2", "L3", "L4", "L5"],
			scored: true,
			dimensionId: "dim-1",
			reverseScored: false,
		},
		{
			type: "scale",
			id: "item-2",
			text: "Item 2",
			required: true,
			min: 1,
			max: 5,
			labels: ["L1", "L2", "L3", "L4", "L5"],
			scored: true,
			dimensionId: "dim-1",
			reverseScored: false,
		},
	],
	responseContextRules: [],
} satisfies InstrumentDocument;

function makeDocWithDuplicateIds(): InstrumentDocument {
	return {
		...docWithN2AndBand4044,
		bands: [
			{ id: "band-low", name: "Low", minScaled: 0, maxScaled: 39 },
			{ id: "band-gap", name: "Gap", minScaled: 40, maxScaled: 44 },
			{ id: "band-mid", name: "Mid", minScaled: 45, maxScaled: 100 },
		],
		items: [
			{
				type: "scale",
				id: "item-1",
				text: "Item 1",
				required: true,
				min: 1,
				max: 5,
				labels: ["L1", "L2", "L3", "L4", "L5"],
				scored: true,
				dimensionId: "dim-1",
				reverseScored: false,
			},
			{
				type: "scale",
				id: "item-1", // duplicate!
				text: "Item 1 dup",
				required: true,
				min: 1,
				max: 5,
				labels: ["L1", "L2", "L3", "L4", "L5"],
				scored: true,
				dimensionId: "dim-1",
				reverseScored: false,
			},
		],
		sections: [
			{
				id: "sec-1",
				title: "Section 1",
				order: 0,
				itemIds: ["item-1"],
			},
		],
	};
}

function makeDocWithAfendaId(): InstrumentDocument {
	return {
		...docWithN2AndBand4044,
		bands: [
			{ id: "band-low", name: "Low", minScaled: 0, maxScaled: 39 },
			{ id: "band-gap", name: "Gap", minScaled: 40, maxScaled: 44 },
			{ id: "band-mid", name: "Mid", minScaled: 45, maxScaled: 100 },
		],
		items: [
			{
				type: "scale",
				id: "afenda-item-1",
				text: "Item 1",
				required: true,
				min: 1,
				max: 5,
				labels: ["L1", "L2", "L3", "L4", "L5"],
				scored: true,
				dimensionId: "dim-1",
				reverseScored: false,
			},
			{
				type: "scale",
				id: "item-2",
				text: "Item 2",
				required: true,
				min: 1,
				max: 5,
				labels: ["L1", "L2", "L3", "L4", "L5"],
				scored: true,
				dimensionId: "dim-1",
				reverseScored: false,
			},
		],
		sections: [
			{
				id: "sec-1",
				title: "Section 1",
				order: 0,
				itemIds: ["afenda-item-1", "item-2"],
			},
		],
	};
}

function makeDocWithBadCharsetId(): InstrumentDocument {
	return {
		...docWithN2AndBand4044,
		bands: [
			{ id: "band-low", name: "Low", minScaled: 0, maxScaled: 39 },
			{ id: "band-gap", name: "Gap", minScaled: 40, maxScaled: 44 },
			{ id: "band-mid", name: "Mid", minScaled: 45, maxScaled: 100 },
		],
		items: [
			{
				type: "scale",
				id: "item 1 with spaces",
				text: "Item 1",
				required: true,
				min: 1,
				max: 5,
				labels: ["L1", "L2", "L3", "L4", "L5"],
				scored: true,
				dimensionId: "dim-1",
				reverseScored: false,
			},
			{
				type: "scale",
				id: "item-2",
				text: "Item 2",
				required: true,
				min: 1,
				max: 5,
				labels: ["L1", "L2", "L3", "L4", "L5"],
				scored: true,
				dimensionId: "dim-1",
				reverseScored: false,
			},
		],
		sections: [
			{
				id: "sec-1",
				title: "Section 1",
				order: 0,
				itemIds: ["item 1 with spaces", "item-2"],
			},
		],
	};
}

/** Document with n=1 scored item per dimension (tests n=0 separately). */
function makeDocWithN0Dimension(): InstrumentDocument {
	return {
		schemaVersion: 1,
		title: "N0 doc",
		candidateIntroduction: "intro",
		consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
		estimatedMinutes: 10,
		displayMode: "continuous",
		scoringMode: "dimensional",
		dimensions: [
			{ id: "dim-1", code: "D1", name: "Dim 1", order: 0 },
			{ id: "dim-2", code: "D2", name: "Dim 2", order: 1 },
		],
		bands: [
			{ id: "b1", name: "Low", minScaled: 0, maxScaled: 100 },
		],
		sections: [
			{
				id: "sec-1",
				title: "S1",
				order: 0,
				itemIds: ["item-1"],
			},
		],
		items: [
			{
				type: "scale",
				id: "item-1",
				text: "Q1",
				required: true,
				min: 1,
				max: 5,
				labels: ["L1", "L2", "L3", "L4", "L5"],
				scored: true,
				dimensionId: "dim-1",
				reverseScored: false,
			},
		],
		responseContextRules: [],
	};
	// Note: dim-2 has zero scored items — violates Zod schema, so we need a
	// raw unknown cast for testing the invariants function on invalid data.
}

// For n=0 we pass unknown so we can bypass parseInstrumentDocument
const rawDocWithDimN0: unknown = {
	schemaVersion: 1,
	title: "N0 doc",
	candidateIntroduction: "intro",
	consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
	estimatedMinutes: 10,
	displayMode: "continuous",
	scoringMode: "dimensional",
	dimensions: [
		{ id: "dim-1", code: "D1", name: "Dim 1", order: 0 },
		{ id: "dim-2", code: "D2", name: "Dim 2 (n=0)", order: 1 },
	],
	bands: [{ id: "b1", name: "All", minScaled: 0, maxScaled: 100 }],
	sections: [{ id: "sec-1", title: "S1", order: 0, itemIds: ["item-1"] }],
	items: [
		{
			type: "scale",
			id: "item-1",
			text: "Q1",
			required: true,
			min: 1,
			max: 5,
			labels: ["L1", "L2", "L3", "L4", "L5"],
			scored: true,
			dimensionId: "dim-1",
			reverseScored: false,
		},
	],
	responseContextRules: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("assertInstrumentInvariants — unreachable band", () => {
	it("publish flags unreachable band 40-44 at n=2", () => {
		const issues = assertInstrumentInvariants(docWithN2AndBand4044, "publish");
		expect(issues.some((i) => i.code === "unreachable_band")).toBe(true);
	});

	it("draft skips unreachable bands", () => {
		expect(
			assertInstrumentInvariants(docWithN2AndBand4044, "draft").some(
				(i) => i.code === "unreachable_band",
			),
		).toBe(false);
	});
});

describe("assertInstrumentInvariants — fixture docs", () => {
	it("Core v1 publish invariants are clean", () => {
		expect(assertInstrumentInvariants(CORE_V1_DOCUMENT, "publish")).toEqual([]);
	});

	it("Pre-joining publish invariants are clean", () => {
		expect(assertInstrumentInvariants(PRE_JOINING_2026_DOCUMENT, "publish")).toEqual([]);
	});
});

describe("assertInstrumentInvariants — duplicate ids (hard in both modes)", () => {
	it("draft flags duplicate item ids as hard error", () => {
		const issues = assertInstrumentInvariants(makeDocWithDuplicateIds(), "draft");
		expect(issues.some((i) => i.code === "duplicate_id" && i.severity === "hard")).toBe(true);
	});

	it("publish flags duplicate item ids as hard error", () => {
		const issues = assertInstrumentInvariants(makeDocWithDuplicateIds(), "publish");
		expect(issues.some((i) => i.code === "duplicate_id" && i.severity === "hard")).toBe(true);
	});
});

describe("assertInstrumentInvariants — id charset (hard in both modes)", () => {
	it("draft flags ids starting with afenda- prefix", () => {
		const issues = assertInstrumentInvariants(makeDocWithAfendaId(), "draft");
		expect(issues.some((i) => i.code === "reserved_prefix" && i.severity === "hard")).toBe(true);
	});

	it("publish flags ids starting with afenda- prefix", () => {
		const issues = assertInstrumentInvariants(makeDocWithAfendaId(), "publish");
		expect(issues.some((i) => i.code === "reserved_prefix" && i.severity === "hard")).toBe(true);
	});

	it("draft flags ids with invalid charset", () => {
		const issues = assertInstrumentInvariants(makeDocWithBadCharsetId(), "draft");
		expect(issues.some((i) => i.code === "invalid_id_charset" && i.severity === "hard")).toBe(true);
	});

	it("publish flags ids with invalid charset", () => {
		const issues = assertInstrumentInvariants(makeDocWithBadCharsetId(), "publish");
		expect(issues.some((i) => i.code === "invalid_id_charset" && i.severity === "hard")).toBe(true);
	});
});

describe("assertInstrumentInvariants — n=0 dimension (publish only)", () => {
	it("draft skips n=0 check", () => {
		expect(
			assertInstrumentInvariants(rawDocWithDimN0, "draft").some((i) => i.code === "dim_n_zero"),
		).toBe(false);
	});

	it("publish flags dimension with zero scored items as hard", () => {
		const issues = assertInstrumentInvariants(rawDocWithDimN0, "publish");
		expect(issues.some((i) => i.code === "dim_n_zero" && i.severity === "hard")).toBe(true);
	});
});

describe("assertInstrumentInvariants — scoringMode consistency (publish only)", () => {
	it("draft skips scoringMode consistency check", () => {
		// A document with scoringMode none but scored items (raw unknown bypasses Zod)
		const rawBadScoringMode: unknown = {
			schemaVersion: 1,
			title: "bad scoring",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 10,
			displayMode: "continuous",
			scoringMode: "none",
			dimensions: [{ id: "dim-1", code: "D1", name: "D1", order: 0 }],
			bands: [{ id: "b1", name: "Low", minScaled: 0, maxScaled: 100 }],
			sections: [{ id: "sec-1", title: "S1", order: 0, itemIds: ["item-1"] }],
			items: [
				{
					type: "scale",
					id: "item-1",
					text: "Q",
					required: true,
					min: 1,
					max: 5,
					labels: ["L1", "L2", "L3", "L4", "L5"],
					scored: true,
					dimensionId: "dim-1",
					reverseScored: false,
				},
			],
			responseContextRules: [],
		};
		expect(
			assertInstrumentInvariants(rawBadScoringMode, "draft").some(
				(i) => i.code === "scoring_mode_conflict",
			),
		).toBe(false);
	});

	it("publish flags scoringMode:none with scored items", () => {
		const rawBadScoringMode: unknown = {
			schemaVersion: 1,
			title: "bad scoring",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 10,
			displayMode: "continuous",
			scoringMode: "none",
			dimensions: [{ id: "dim-1", code: "D1", name: "D1", order: 0 }],
			bands: [{ id: "b1", name: "Low", minScaled: 0, maxScaled: 100 }],
			sections: [{ id: "sec-1", title: "S1", order: 0, itemIds: ["item-1"] }],
			items: [
				{
					type: "scale",
					id: "item-1",
					text: "Q",
					required: true,
					min: 1,
					max: 5,
					labels: ["L1", "L2", "L3", "L4", "L5"],
					scored: true,
					dimensionId: "dim-1",
					reverseScored: false,
				},
			],
			responseContextRules: [],
		};
		const issues = assertInstrumentInvariants(rawBadScoringMode, "publish");
		expect(issues.some((i) => i.code === "scoring_mode_conflict" && i.severity === "hard")).toBe(
			true,
		);
	});
});

describe("assertInstrumentInvariants — item in multiple sections (publish only)", () => {
	it("draft skips item-in-multiple-sections check", () => {
		const rawMultiSection: unknown = {
			schemaVersion: 1,
			title: "multi-section",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 10,
			displayMode: "continuous",
			scoringMode: "none",
			dimensions: [],
			bands: [],
			sections: [
				{ id: "sec-1", title: "S1", order: 0, itemIds: ["item-1"] },
				{ id: "sec-2", title: "S2", order: 1, itemIds: ["item-1"] },
			],
			items: [{ type: "short_text", id: "item-1", text: "Q1", required: false }],
			responseContextRules: [],
		};
		expect(
			assertInstrumentInvariants(rawMultiSection, "draft").some(
				(i) => i.code === "item_in_multiple_sections",
			),
		).toBe(false);
	});

	it("publish flags item listed in two sections as hard error", () => {
		const rawMultiSection: unknown = {
			schemaVersion: 1,
			title: "multi-section",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 10,
			displayMode: "continuous",
			scoringMode: "none",
			dimensions: [],
			bands: [],
			sections: [
				{ id: "sec-1", title: "S1", order: 0, itemIds: ["item-1"] },
				{ id: "sec-2", title: "S2", order: 1, itemIds: ["item-1"] },
			],
			items: [{ type: "short_text", id: "item-1", text: "Q1", required: false }],
			responseContextRules: [],
		};
		const issues = assertInstrumentInvariants(rawMultiSection, "publish");
		expect(
			issues.some((i) => i.code === "item_in_multiple_sections" && i.severity === "hard"),
		).toBe(true);
	});
});

describe("assertInstrumentInvariants — integrity checks (publish only)", () => {
	it("draft skips dangling sectionId check", () => {
		const rawDanglingRef: unknown = {
			schemaVersion: 1,
			title: "dangling",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 10,
			displayMode: "continuous",
			scoringMode: "none",
			dimensions: [],
			bands: [],
			sections: [
				{
					id: "sec-1",
					title: "S1",
					order: 0,
					itemIds: ["item-1", "nonexistent-item"],
				},
			],
			items: [
				{
					type: "short_text",
					id: "item-1",
					text: "Q1",
					required: false,
				},
			],
			responseContextRules: [],
		};
		expect(
			assertInstrumentInvariants(rawDanglingRef, "draft").some((i) => i.code === "dangling_ref"),
		).toBe(false);
	});

	it("publish flags dangling itemIds reference as hard", () => {
		const rawDanglingRef: unknown = {
			schemaVersion: 1,
			title: "dangling",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 10,
			displayMode: "continuous",
			scoringMode: "none",
			dimensions: [],
			bands: [],
			sections: [
				{
					id: "sec-1",
					title: "S1",
					order: 0,
					itemIds: ["item-1", "nonexistent-item"],
				},
			],
			items: [
				{
					type: "short_text",
					id: "item-1",
					text: "Q1",
					required: false,
				},
			],
			responseContextRules: [],
		};
		const issues = assertInstrumentInvariants(rawDanglingRef, "publish");
		expect(issues.some((i) => i.code === "dangling_ref" && i.severity === "hard")).toBe(true);
	});

	it("publish flags item not in any section as hard", () => {
		const rawOrphanItem: unknown = {
			schemaVersion: 1,
			title: "orphan",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 10,
			displayMode: "continuous",
			scoringMode: "none",
			dimensions: [],
			bands: [],
			sections: [{ id: "sec-1", title: "S1", order: 0, itemIds: ["item-1"] }],
			items: [
				{
					type: "short_text",
					id: "item-1",
					text: "Q1",
					required: false,
				},
				{
					type: "short_text",
					id: "item-orphan",
					text: "Q2",
					required: false,
				},
			],
			responseContextRules: [],
		};
		const issues = assertInstrumentInvariants(rawOrphanItem, "publish");
		expect(issues.some((i) => i.code === "item_not_in_section" && i.severity === "hard")).toBe(
			true,
		);
	});
});

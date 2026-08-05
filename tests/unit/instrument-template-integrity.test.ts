import { describe, expect, it } from "vitest";
import { assertReferentialIntegrity } from "@/lib/instrument-template/integrity";
import { assertInstrumentInvariants } from "@/lib/instrument-invariants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minimalItem(id: string, type = "text") {
	return { id, type, scored: false };
}

function sectionWith(id: string, itemIds: string[]) {
	return { id, title: "Sec", itemIds };
}

// ---------------------------------------------------------------------------
// Dangling dimensionId
// ---------------------------------------------------------------------------

describe("assertReferentialIntegrity – dangling dimensionId", () => {
	it("returns hard issue when scored item references missing dimension", () => {
		const doc = {
			items: [{ id: "item-1", type: "scale", scored: true, dimensionId: "dim-missing" }],
			sections: [sectionWith("sec-1", ["item-1"])],
			dimensions: [],
			bands: [],
		};
		const issues = assertReferentialIntegrity(doc);
		const dRef = issues.filter((i) => i.code === "dangling_ref");
		expect(dRef.length).toBeGreaterThanOrEqual(1);
		expect(dRef[0].message).toContain("dim-missing");
		expect(dRef[0].severity).toBe("hard");
	});

	it("returns no issue when dimensionId exists", () => {
		const doc = {
			items: [{ id: "item-1", type: "scale", scored: true, dimensionId: "dim-1" }],
			sections: [sectionWith("sec-1", ["item-1"])],
			dimensions: [{ id: "dim-1", label: "Dim" }],
			bands: [],
		};
		const issues = assertReferentialIntegrity(doc);
		expect(issues.filter((i) => i.code === "dangling_ref")).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Item not in any section
// ---------------------------------------------------------------------------

describe("assertReferentialIntegrity – item not in section", () => {
	it("returns hard issue when item is not referenced by any section", () => {
		const doc = {
			items: [minimalItem("item-1"), minimalItem("item-2")],
			sections: [sectionWith("sec-1", ["item-1"])], // item-2 missing
			dimensions: [],
			bands: [],
		};
		const issues = assertReferentialIntegrity(doc);
		const notInSection = issues.filter((i) => i.code === "item_not_in_section");
		expect(notInSection.length).toBeGreaterThanOrEqual(1);
		expect(notInSection[0].message).toContain("item-2");
	});

	it("returns no issue when all items are in sections", () => {
		const doc = {
			items: [minimalItem("item-1"), minimalItem("item-2")],
			sections: [sectionWith("sec-1", ["item-1", "item-2"])],
			dimensions: [],
			bands: [],
		};
		const issues = assertReferentialIntegrity(doc);
		expect(issues.filter((i) => i.code === "item_not_in_section")).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Item in two sections
// ---------------------------------------------------------------------------

describe("assertReferentialIntegrity – item in multiple sections", () => {
	it("returns hard issue when item is in two sections", () => {
		const doc = {
			items: [minimalItem("item-1")],
			sections: [
				sectionWith("sec-1", ["item-1"]),
				sectionWith("sec-2", ["item-1"]),
			],
			dimensions: [],
			bands: [],
		};
		const issues = assertReferentialIntegrity(doc);
		const multi = issues.filter((i) => i.code === "item_in_multiple_sections");
		expect(multi.length).toBeGreaterThanOrEqual(1);
		expect(multi[0].message).toContain("item-1");
		expect(multi[0].severity).toBe("hard");
	});
});

// ---------------------------------------------------------------------------
// Dangling section itemId
// ---------------------------------------------------------------------------

describe("assertReferentialIntegrity – dangling section itemId", () => {
	it("returns hard issue when section references non-existent item", () => {
		const doc = {
			items: [minimalItem("item-1")],
			sections: [sectionWith("sec-1", ["item-1", "ghost-item"])],
			dimensions: [],
			bands: [],
		};
		const issues = assertReferentialIntegrity(doc);
		const dRef = issues.filter((i) => i.code === "dangling_ref");
		expect(dRef.length).toBeGreaterThanOrEqual(1);
		expect(dRef[0].message).toContain("ghost-item");
	});
});

// ---------------------------------------------------------------------------
// Clean document returns []
// ---------------------------------------------------------------------------

describe("assertReferentialIntegrity – clean document", () => {
	it("returns [] for a well-formed document", () => {
		const doc = {
			items: [minimalItem("item-1"), minimalItem("item-2")],
			sections: [sectionWith("sec-1", ["item-1", "item-2"])],
			dimensions: [],
			bands: [],
		};
		expect(assertReferentialIntegrity(doc)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// assertInstrumentInvariants publish – Core/Pre-joining-style docs return []
// (confirms extracting integrity slice didn't break publish behavior)
// ---------------------------------------------------------------------------

describe("assertInstrumentInvariants – publish: clean docs return []", () => {
	it("Core-style doc (scoringMode none, no dims/bands)", () => {
		const doc = {
			scoringMode: "none",
			items: [{ id: "i1", type: "text", scored: false }],
			sections: [{ id: "s1", title: "Sec", itemIds: ["i1"] }],
			dimensions: [],
			bands: [],
			responseContextRules: [],
		};
		expect(assertInstrumentInvariants(doc, "publish")).toHaveLength(0);
	});

	it("Pre-joining-style doc (scoringMode dimensional)", () => {
		const doc = {
			scoringMode: "dimensional",
			items: [{ id: "i1", type: "scale", scored: true, dimensionId: "d1" }],
			sections: [{ id: "s1", title: "Sec", itemIds: ["i1"] }],
			dimensions: [{ id: "d1", label: "Dim" }],
			bands: [{ id: "b1", dimensionId: "d1", minScaled: 0, maxScaled: 100 }],
			responseContextRules: [],
		};
		// Should be clean (band covers reachable range for n=1)
		const issues = assertInstrumentInvariants(doc, "publish");
		expect(issues.filter((i) => i.code !== "unreachable_band")).toHaveLength(0);
	});
});

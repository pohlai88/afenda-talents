import { describe, expect, it } from "vitest";
import salesJson from "../../data/Sales_Performance_Role_Positioning_Assessment.json";
import { buildCandidateBlocks } from "@/lib/candidate-form";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import { orderedDimensionCodes } from "@/lib/instrument-labels";
import {
	dimensionLabel,
	legendFromDocument,
	normalizeDimensions,
} from "@/lib/result-display";

/**
 * A document may define any dimension codes and any number of bands. These lock the
 * results UI and the candidate payload to the version document rather than to Core v1,
 * using a real 12-dimension, 5-band document as the counter-example.
 */
const salesDoc = parseInstrumentDocument(salesJson);
const salesLegend = legendFromDocument(salesDoc);

describe("result display is driven by the version document", () => {
	it("keeps a band name Core v1 does not define", () => {
		const stored = [
			{ id: "dim-HUN", code: "HUN", raw: 14, scaled: 62, band: { id: "band-capable", name: "Capable" } },
		];
		expect(normalizeDimensions(stored, salesLegend)[0]?.band).toBe("Capable");
	});

	it("derives the band from the document when a legacy row stored none", () => {
		const stored = [{ id: "dim-HUN", code: "HUN", raw: 14, scaled: 95 }];
		expect(normalizeDimensions(stored, salesLegend)[0]?.band).toBe(
			"Distinctive Strength",
		);
	});

	it("prefers the document name over a colliding Core v1 code", () => {
		// "COM" is Core v1's communication dimension and this document's commercial one.
		expect(dimensionLabel("COM", salesLegend)).toBe("Commercial Acumen & Value");
		expect(dimensionLabel("COM")).toBe("Communication and collaboration");
	});

	it("names every dimension of a document Core v1 knows nothing about", () => {
		const named = salesDoc.dimensions.map((d) => dimensionLabel(d.code, salesLegend));
		expect(named).not.toContain("HUN");
		expect(named).toContain("Prospecting Drive & Initiative");
	});

	it("orders codes by the document, keeping VAL after the scored dimensions", () => {
		const shuffled = ["VAL", "ETH", "HUN", "COM"];
		expect(
			orderedDimensionCodes(shuffled, [...salesLegend.order, "VAL"]),
		).toEqual(["HUN", "COM", "ETH", "VAL"]);
	});

	it("still labels Core v1 results when no legend is available", () => {
		const coreLegend = legendFromDocument(CORE_V1_DOCUMENT);
		expect(dimensionLabel("WER", coreLegend)).toBe("Work ethic and reliability");
		expect(dimensionLabel("WER")).toBe("Work ethic and reliability");
	});

	it("exposes bands sorted and covering 0–100", () => {
		expect(salesLegend.bands.map((b) => b.minScaled)).toEqual([0, 40, 60, 75, 90]);
		expect(salesLegend.bands.at(-1)?.maxScaled).toBe(100);
	});
});

describe("candidate payload carries the document's framing", () => {
	const blocks = buildCandidateBlocks(salesDoc);

	it("emits a header for every section of a by-section document", () => {
		const sections = blocks.filter((b) => b.kind === "section");
		expect(sections).toHaveLength(salesDoc.sections.length);
		expect(sections.map((s) => s.kind === "section" && s.title)).toContain(
			"Battle-Tested Sales Simulations",
		);
	});

	it("carries section introductions rather than dropping them", () => {
		const first = blocks.find((b) => b.kind === "section");
		expect(first?.kind === "section" && first.introduction).toBeTruthy();
	});

	it("emits every info block", () => {
		const infoIds = blocks.flatMap((b) => (b.kind === "info" ? [b.id] : []));
		const expected = salesDoc.items
			.filter((i) => i.type === "info")
			.map((i) => i.id);
		expect(infoIds).toEqual(expected);
	});

	it("numbers answerable items only, consecutively from 1", () => {
		const items = blocks.flatMap((b) => (b.kind === "item" ? [b.item] : []));
		const answerable = salesDoc.items.filter((i) => i.type !== "info");
		expect(items).toHaveLength(answerable.length);
		expect(items.map((i) => i.order)).toEqual(
			answerable.map((_, index) => index + 1),
		);
	});

	it("places each item exactly once, in section order", () => {
		const ids = blocks.flatMap((b) => (b.kind === "item" ? [b.item.id] : []));
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids[0]).toBe(salesDoc.sections[0]?.itemIds[1]); // [0] is that section's info block
	});

	it("emits no section headers for a continuous document", () => {
		const coreBlocks = buildCandidateBlocks(CORE_V1_DOCUMENT);
		expect(coreBlocks.some((b) => b.kind === "section")).toBe(false);
		expect(coreBlocks.every((b) => b.kind === "item")).toBe(true);
	});
});

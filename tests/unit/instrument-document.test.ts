import { describe, expect, it } from "vitest";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { parseInstrumentDocument } from "@/lib/instrument-document";

describe("CORE_V1_DOCUMENT", () => {
	it("parses as a valid instrument document", () => {
		const doc = parseInstrumentDocument(CORE_V1_DOCUMENT);
		expect(doc.title).toBe("Afenda Core Behavioural Profile");
		expect(doc.items).toHaveLength(34);
		expect(doc.dimensions).toHaveLength(5);
		expect(doc.responseContextRules).toHaveLength(4);
	});

	it("rejects orphan items", () => {
		expect(() =>
			parseInstrumentDocument({
				...CORE_V1_DOCUMENT,
				sections: [{ id: "s", title: "S", order: 0, itemIds: ["WER-1"] }],
			}),
		).toThrow();
	});

	it("rejects a scored dimension with zero items", () => {
		expect(() =>
			parseInstrumentDocument({
				...CORE_V1_DOCUMENT,
				dimensions: [
					...CORE_V1_DOCUMENT.dimensions,
					{
						id: "dim-EMPTY",
						code: "EMPTY",
						name: "Empty",
						order: 99,
					},
				],
			}),
		).toThrow();
	});
});

describe("scoringMode", () => {
	it("defaults a legacy document with no scoringMode to dimensional", () => {
		const { scoringMode, ...legacy } = CORE_V1_DOCUMENT as typeof CORE_V1_DOCUMENT & {
			scoringMode?: string;
		};
		void scoringMode;
		const doc = parseInstrumentDocument(legacy);
		expect(doc.scoringMode).toBe("dimensional");
	});

	it("rewrites legacy likert items to scale", () => {
		const legacy = {
			...CORE_V1_DOCUMENT,
			items: CORE_V1_DOCUMENT.items.map((item) =>
				item.type === "scale" ? { ...item, type: "likert" } : item,
			),
		};
		const doc = parseInstrumentDocument(legacy);
		expect(doc.items.some((i) => i.type === "scale")).toBe(true);
		expect(doc.items.some((i) => (i as { type: string }).type === "likert")).toBe(false);
	});

	it("accepts a scoringMode 'none' document with no dimensions or bands", () => {
		const doc = parseInstrumentDocument({
			schemaVersion: 1,
			title: "Pre-joining",
			candidateIntroduction: "Tell us about yourself before you start.",
			consent: {
				purpose: "p",
				whatWeCollect: "w",
				whoSeesIt: "h",
				retention: "r",
			},
			estimatedMinutes: 25,
			displayMode: "section",
			scoringMode: "none",
			dimensions: [],
			bands: [],
			sections: [{ id: "s1", title: "About you", order: 0, itemIds: ["a1"] }],
			items: [
				{
					type: "short_text",
					id: "a1",
					text: "Preferred work location",
					required: true,
				},
			],
			responseContextRules: [],
		});
		expect(doc.scoringMode).toBe("none");
		expect(doc.dimensions).toHaveLength(0);
	});

	it("rejects a scoringMode 'none' document that has scored items", () => {
		expect(() =>
			parseInstrumentDocument({ ...CORE_V1_DOCUMENT, scoringMode: "none", dimensions: [], bands: [] }),
		).toThrow();
	});

	it("rejects a scoringMode 'dimensional' document with no dimensions", () => {
		expect(() =>
			parseInstrumentDocument({ ...CORE_V1_DOCUMENT, dimensions: [] }),
		).toThrow();
	});
});

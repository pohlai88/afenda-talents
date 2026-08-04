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

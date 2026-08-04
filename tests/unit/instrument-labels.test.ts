import { describe, expect, it } from "vitest";
import {
	bandInterpretation,
	likertLabel,
	orderedDimensionCodes,
} from "@/lib/instrument-labels";

describe("instrument-labels", () => {
	it("orders competency codes then VAL then unknowns", () => {
		expect(orderedDimensionCodes(["VAL", "INA", "WER", "ZZZ"])).toEqual([
			"WER",
			"INA",
			"VAL",
			"ZZZ",
		]);
	});

	it("maps Likert values to assessment labels", () => {
		expect(likertLabel(1)).toBe("Strongly disagree");
		expect(likertLabel(3)).toBe("Neither agree nor disagree");
		expect(likertLabel(5)).toBe("Strongly agree");
	});

	it("gives a deterministic band line without narrative judgement", () => {
		expect(bandInterpretation("Effective")).toBe(
			"This dimension falls within the Effective band.",
		);
		expect(bandInterpretation("Developing")).not.toMatch(
			/weak|poor|excellent/i,
		);
	});
});

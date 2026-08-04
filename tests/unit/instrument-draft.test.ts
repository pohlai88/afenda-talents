import { describe, expect, it } from "vitest";
import {
	blankInstrumentDocument,
	collectPublishIssues,
	parseDraftDocument,
	publishBlockers,
} from "@/lib/instrument-draft";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";

describe("blankInstrumentDocument", () => {
	it("parses as a draft", () => {
		const draft = blankInstrumentDocument("Test");
		expect(parseDraftDocument(draft).title).toBe("Test");
	});

	it("fails strict publish until content is filled", () => {
		const draft = blankInstrumentDocument();
		expect(() => parseInstrumentDocument(draft)).toThrow();
	});
});

describe("collectPublishIssues", () => {
	it("finds no blockers on Core v1", () => {
		const issues = collectPublishIssues(CORE_V1_DOCUMENT);
		expect(publishBlockers(issues)).toHaveLength(0);
	});

	it("warns on long estimated time", () => {
		const issues = collectPublishIssues({
			...CORE_V1_DOCUMENT,
			estimatedMinutes: 60,
		});
		expect(issues.some((i) => i.code === "long_assessment")).toBe(true);
	});
});

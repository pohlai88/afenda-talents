import { describe, expect, it } from "vitest";
import { canonicalCell } from "@/lib/instrument-template/cells";

describe("canonicalCell bool", () => {
	it.each([
		["TRUE", true],
		["true", true],
		["1", true],
		["yes", true],
		[1, true],
		[true, true],
	])("accepts %j as true", (raw, expected) => {
		expect(canonicalCell(raw, "bool")).toEqual({ ok: true, value: expected });
	});

	it.each([
		["FALSE", false],
		["false", false],
		["0", false],
		["no", false],
		[0, false],
		[false, false],
	])("accepts %j as false", (raw, expected) => {
		expect(canonicalCell(raw, "bool")).toEqual({ ok: true, value: expected });
	});

	it("rejects invalid bool strings", () => {
		expect(canonicalCell("maybe", "bool")).toEqual({ ok: false, issue: "invalid" });
	});
});

describe("canonicalCell int", () => {
	it("coerces 5.0 to integer 5", () => {
		expect(canonicalCell(5.0, "int")).toEqual({ ok: true, value: 5 });
		expect(canonicalCell("5.0", "int")).toEqual({ ok: true, value: 5 });
	});

	it("rejects non-integer values", () => {
		expect(canonicalCell(5.1, "int")).toEqual({ ok: false, issue: "invalid" });
		expect(canonicalCell("5.1", "int")).toEqual({ ok: false, issue: "invalid" });
	});

	it("rejects locale junk", () => {
		expect(canonicalCell("1,234", "int")).toEqual({ ok: false, issue: "invalid" });
		expect(canonicalCell("5 0", "int")).toEqual({ ok: false, issue: "invalid" });
	});
});

describe("canonicalCell number", () => {
	it("returns integers for whole values", () => {
		expect(canonicalCell(5, "number")).toEqual({ ok: true, value: 5 });
		expect(canonicalCell(5.0, "number")).toEqual({ ok: true, value: 5 });
		expect(canonicalCell("5.0", "number")).toEqual({ ok: true, value: 5 });
	});

	it("returns floats with trailing zeros trimmed", () => {
		expect(canonicalCell("5.10", "number")).toEqual({ ok: true, value: 5.1 });
		expect(canonicalCell(5.1, "number")).toEqual({ ok: true, value: 5.1 });
	});
});

describe("canonicalCell text", () => {
	it("trims whitespace", () => {
		expect(canonicalCell("  hello  ", "text")).toEqual({ ok: true, value: "hello" });
	});

	it("maps empty to null", () => {
		expect(canonicalCell("", "text")).toEqual({ ok: true, value: null });
		expect(canonicalCell("   ", "text")).toEqual({ ok: true, value: null });
		expect(canonicalCell(null, "text")).toEqual({ ok: true, value: null });
		expect(canonicalCell(undefined, "text")).toEqual({ ok: true, value: null });
	});
});

describe("canonicalCell id", () => {
	it("rejects scientific notation", () => {
		expect(canonicalCell("1.23E+21", "id")).toEqual({ ok: false, issue: "scientific_notation" });
		expect(canonicalCell("1e10", "id")).toEqual({ ok: false, issue: "scientific_notation" });
	});

	it("accepts ids that merely contain the letter e", () => {
		expect(canonicalCell("item-ready", "id")).toEqual({ ok: true, value: "item-ready" });
	});

	it("trims and maps empty to null", () => {
		expect(canonicalCell("  sec-1  ", "id")).toEqual({ ok: true, value: "sec-1" });
		expect(canonicalCell("", "id")).toEqual({ ok: true, value: null });
	});
});

describe("canonicalCell empty for all kinds", () => {
	it.each(["text", "bool", "int", "number", "id"] as const)("maps empty to null for %s", (kind) => {
		expect(canonicalCell("", kind)).toEqual({ ok: true, value: null });
		expect(canonicalCell(null, kind)).toEqual({ ok: true, value: null });
	});
});

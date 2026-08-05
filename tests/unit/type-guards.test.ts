import { describe, expect, it } from "vitest";
import {
	assertRole,
	assertRoundStatus,
	assertStatus,
	isRole,
	isRoundStatus,
	isStatus,
	parseRole,
	parseRoundStatus,
	parseStatus,
} from "@/lib/type-guards";

describe("type-guards", () => {
	it("narrows assignment statuses", () => {
		expect(isStatus("SENT")).toBe(true);
		expect(isStatus("WAT")).toBe(false);
		expect(parseStatus("SCORED")).toBe("SCORED");
		expect(() => parseStatus("WAT")).toThrow(/Invalid status/);
	});

	it("narrows hiring roles", () => {
		expect(isRole("ADMIN")).toBe(true);
		expect(isRole("SUPER")).toBe(false);
		assertRole("VIEWER");
		expect(() => assertRole("SUPER")).toThrow(/Invalid role/);
	});

	it("narrows round statuses", () => {
		expect(isRoundStatus("OPEN")).toBe(true);
		expect(isRoundStatus("RUNNING")).toBe(false);
		expect(parseRoundStatus("CLOSED")).toBe("CLOSED");
		expect(() => assertRoundStatus("RUNNING")).toThrow(/Invalid round status/);
	});
});

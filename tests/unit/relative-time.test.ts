import { describe, expect, it } from "vitest";
import { relativeTime, untilTime } from "@/lib/relative-time";

describe("relativeTime", () => {
	const now = new Date("2026-08-05T12:00:00.000Z");

	it("formats recent and older deltas", () => {
		expect(relativeTime(new Date("2026-08-05T11:59:45.000Z"), now)).toBe("just now");
		expect(relativeTime(new Date("2026-08-05T11:45:00.000Z"), now)).toBe("15 minutes ago");
		expect(relativeTime(new Date("2026-08-05T09:00:00.000Z"), now)).toBe("3 hours ago");
		expect(relativeTime(new Date("2026-08-03T12:00:00.000Z"), now)).toBe("2 days ago");
	});
});

describe("untilTime", () => {
	const now = new Date("2026-08-05T12:00:00.000Z");

	it("formats upcoming windows", () => {
		expect(untilTime(new Date("2026-08-05T12:20:00.000Z"), now)).toBe("in under an hour");
		expect(untilTime(new Date("2026-08-05T15:00:00.000Z"), now)).toBe("in 3 hours");
		expect(untilTime(new Date("2026-08-07T12:00:00.000Z"), now)).toBe("in 2 days");
	});
});

import { describe, expect, it } from "vitest";
import { stabilizePgUrl } from "@/lib/pg-url";

describe("stabilizePgUrl", () => {
	it("adds uselibpqcompat when missing", () => {
		const out = stabilizePgUrl(
			"postgresql://u:p@host/db?sslmode=require",
		);
		expect(out).toContain("uselibpqcompat=true");
		expect(out).toContain("sslmode=require");
	});

	it("preserves existing uselibpqcompat", () => {
		const out = stabilizePgUrl(
			"postgresql://u:p@host/db?sslmode=require&uselibpqcompat=true",
		);
		expect(out.match(/uselibpqcompat=/g)?.length).toBe(1);
	});
});

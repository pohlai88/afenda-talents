import { describe, expect, it } from "vitest";
import { navItemIsActive } from "@/lib/nav-active";

describe("navItemIsActive", () => {
	it("activates Overview only on exact /admin", () => {
		expect(navItemIsActive("/admin", { href: "/admin" })).toBe(true);
		expect(navItemIsActive("/admin/candidates", { href: "/admin" })).toBe(false);
	});

	it("activates Candidates on list and singular detail routes", () => {
		const item = {
			href: "/admin/candidates",
			matchPrefixes: ["/admin/candidate"],
		};
		expect(navItemIsActive("/admin/candidates", item)).toBe(true);
		expect(navItemIsActive("/admin/candidate/abc", item)).toBe(true);
		expect(navItemIsActive("/admin/assessments", item)).toBe(false);
	});

	it("activates Assessments nested edit routes", () => {
		const item = { href: "/admin/assessments" };
		expect(navItemIsActive("/admin/assessments/x/edit", item)).toBe(true);
	});
});

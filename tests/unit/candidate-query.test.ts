import { describe, expect, it } from "vitest";
import {
	PAGE_SIZE,
	activeFilterCount,
	parseCandidateQuery,
} from "@/lib/candidate-query";

describe("parseCandidateQuery", () => {
	it("defaults to no filters, newest-invited first, page 1", () => {
		const q = parseCandidateQuery({});
		expect(q).toEqual({
			search: "",
			status: null,
			shortcut: null,
			sort: "invited",
			direction: "desc",
			page: 1,
		});
	});

	it("trims the search term", () => {
		expect(parseCandidateQuery({ q: "  amira  " }).search).toBe("amira");
	});

	it("ignores a status that is not a real one", () => {
		expect(parseCandidateQuery({ status: "DROP TABLE" }).status).toBeNull();
		expect(parseCandidateQuery({ status: "SENT" }).status).toBe("SENT");
	});

	it("ignores an unknown shortcut and an unknown sort key", () => {
		expect(parseCandidateQuery({ view: "nonsense" }).shortcut).toBeNull();
		expect(parseCandidateQuery({ sort: "score" }).sort).toBe("invited");
	});

	it("clamps the page to at least 1", () => {
		expect(parseCandidateQuery({ page: "0" }).page).toBe(1);
		expect(parseCandidateQuery({ page: "-4" }).page).toBe(1);
		expect(parseCandidateQuery({ page: "banana" }).page).toBe(1);
		expect(parseCandidateQuery({ page: "3" }).page).toBe(3);
	});
});

describe("activeFilterCount", () => {
	it("counts only what the person actually set", () => {
		expect(activeFilterCount(parseCandidateQuery({}))).toBe(0);
		expect(activeFilterCount(parseCandidateQuery({ q: "a" }))).toBe(1);
		expect(activeFilterCount(parseCandidateQuery({ q: "a", status: "SENT" }))).toBe(2);
		// Sort and page are not filters.
		expect(activeFilterCount(parseCandidateQuery({ sort: "name", page: "2" }))).toBe(0);
	});
});

describe("paging", () => {
	it("uses a page size the registry can actually render", () => {
		expect(PAGE_SIZE).toBeGreaterThan(0);
		expect(PAGE_SIZE).toBeLessThanOrEqual(50);
	});
});

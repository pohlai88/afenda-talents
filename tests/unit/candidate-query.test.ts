import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  activeFilterCount,
  parseCandidateQuery,
  queryToWhere,
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

describe("queryToWhere", () => {
  it("is empty when nothing is filtered", () => {
    expect(queryToWhere(parseCandidateQuery({}))).toEqual({});
  });

  it("searches name and email case-insensitively", () => {
    const where = queryToWhere(parseCandidateQuery({ q: "amira" }));
    expect(where).toEqual({
      OR: [
        { fullName: { contains: "amira", mode: "insensitive" } },
        { email: { contains: "amira", mode: "insensitive" } },
      ],
    });
  });

  it("filters by an explicit status", () => {
    expect(queryToWhere(parseCandidateQuery({ status: "SCORED" }))).toEqual({ status: "SCORED" });
  });

  it("expands each shortcut into real statuses", () => {
    expect(queryToWhere(parseCandidateQuery({ view: "ready-for-review" }))).toEqual({
      status: { in: ["SCORED"] },
    });
    expect(queryToWhere(parseCandidateQuery({ view: "in-progress" }))).toEqual({
      status: { in: ["STARTED", "SUBMITTED"] },
    });
    expect(queryToWhere(parseCandidateQuery({ view: "needs-follow-up" }))).toEqual({
      status: { in: ["SENT"] },
    });
    expect(queryToWhere(parseCandidateQuery({ view: "closed" }))).toEqual({
      status: { in: ["EXPIRED", "REVOKED"] },
    });
  });

  it("lets an explicit status win over a shortcut", () => {
    const where = queryToWhere(parseCandidateQuery({ view: "closed", status: "SENT" }));
    expect(where).toEqual({ status: "SENT" });
  });

  it("combines search and status", () => {
    const where = queryToWhere(parseCandidateQuery({ q: "tan", status: "SENT" }));
    expect(where.status).toBe("SENT");
    expect(where.OR).toHaveLength(2);
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

import { describe, expect, it } from "vitest";
import { mintId, applyIdentity } from "@/lib/instrument-template/identity";
import type { ParsedEntityRows, SourceDoc } from "@/lib/instrument-template/identity";

// ---------------------------------------------------------------------------
// mintId
// ---------------------------------------------------------------------------

describe("mintId", () => {
	it("produces a string with the correct prefix", () => {
		expect(mintId("it")).toMatch(/^it_/);
		expect(mintId("sec")).toMatch(/^sec_/);
		expect(mintId("dim")).toMatch(/^dim_/);
		expect(mintId("bnd")).toMatch(/^bnd_/);
	});

	it("produces exactly 12 hex chars after the underscore", () => {
		const id = mintId("it");
		// "it_" = 3 chars; remainder should be 12 hex chars
		const hex = id.slice("it_".length);
		expect(hex).toHaveLength(12);
		expect(hex).toMatch(/^[0-9a-f]{12}$/);
	});

	it("mints unique ids each call", () => {
		const ids = Array.from({ length: 20 }, () => mintId("it"));
		expect(new Set(ids).size).toBe(20);
	});
});

// ---------------------------------------------------------------------------
// applyIdentity – helpers
// ---------------------------------------------------------------------------

function emptyRows(): ParsedEntityRows {
	return { items: [], sections: [], dimensions: [], bands: [] };
}

// ---------------------------------------------------------------------------
// blank id → mint
// ---------------------------------------------------------------------------

describe("applyIdentity – blank ids mint", () => {
	it("mints id when id is null", () => {
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [{ id: null, label: "Q1" }],
		};
		const result = applyIdentity(rows, null, "create");
		expect(result.issues).toHaveLength(0);
		expect(result.documentPartial.items[0].id).toMatch(/^it_[0-9a-f]{12}$/);
	});

	it("mints id when id is empty string", () => {
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [{ id: "", label: "Q1" }],
		};
		const result = applyIdentity(rows, null, "create");
		expect(result.issues).toHaveLength(0);
		expect(result.documentPartial.items[0].id).toMatch(/^it_[0-9a-f]{12}$/);
	});

	it("mints id when id is whitespace only", () => {
		const rows: ParsedEntityRows = {
			...emptyRows(),
			sections: [{ id: "   ", title: "Sec A" }],
		};
		const result = applyIdentity(rows, null, "create");
		expect(result.issues).toHaveLength(0);
		expect(result.documentPartial.sections[0].id).toMatch(/^sec_[0-9a-f]{12}$/);
	});
});

// ---------------------------------------------------------------------------
// populated id on create → kept
// ---------------------------------------------------------------------------

describe("applyIdentity – populated id on create", () => {
	it("keeps a valid populated id", () => {
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [{ id: "my-item-1", label: "Q1" }],
		};
		const result = applyIdentity(rows, null, "create");
		expect(result.issues).toHaveLength(0);
		expect(result.documentPartial.items[0].id).toBe("my-item-1");
	});
});

// ---------------------------------------------------------------------------
// update phase: unknown populated id → hard
// ---------------------------------------------------------------------------

describe("applyIdentity – update phase", () => {
	it("accepts id that exists in sourceDoc", () => {
		const source: SourceDoc = { items: [{ id: "known-item" }] };
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [{ id: "known-item", label: "Q1" }],
		};
		const result = applyIdentity(rows, source, "update");
		expect(result.issues).toHaveLength(0);
		expect(result.documentPartial.items[0].id).toBe("known-item");
	});

	it("rejects id that does not exist in sourceDoc", () => {
		const source: SourceDoc = { items: [{ id: "other-item" }] };
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [{ id: "unknown-item", label: "Q1" }],
		};
		const result = applyIdentity(rows, source, "update");
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0].code).toBe("unknown_id");
		expect(result.issues[0].severity).toBe("hard");
	});

	it("null sourceDoc means all populated ids are unknown on update", () => {
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [{ id: "some-item" }],
		};
		const result = applyIdentity(rows, null, "update");
		expect(result.issues[0].code).toBe("unknown_id");
	});
});

// ---------------------------------------------------------------------------
// duplicate ids → issue on every collision
// ---------------------------------------------------------------------------

describe("applyIdentity – duplicate ids", () => {
	it("emits hard issue for each duplicate row", () => {
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [
				{ id: "dup-id", label: "A" },
				{ id: "dup-id", label: "B" },
				{ id: "dup-id", label: "C" },
			],
		};
		const result = applyIdentity(rows, null, "create");
		const dupIssues = result.issues.filter((i) => i.code === "duplicate_id");
		// All three rows collide
		expect(dupIssues.length).toBeGreaterThanOrEqual(2);
		expect(dupIssues.every((i) => i.severity === "hard")).toBe(true);
	});

	it("does not report non-duplicate ids", () => {
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [
				{ id: "id-a", label: "A" },
				{ id: "id-b", label: "B" },
			],
		};
		const result = applyIdentity(rows, null, "create");
		expect(result.issues.filter((i) => i.code === "duplicate_id")).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// scientific notation → hard issue via canonicalCell
// ---------------------------------------------------------------------------

describe("applyIdentity – scientific notation", () => {
	it("rejects id with scientific notation", () => {
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [{ id: "1.23E+21", label: "Q1" }],
		};
		const result = applyIdentity(rows, null, "create");
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0].code).toBe("scientific_notation");
		expect(result.issues[0].severity).toBe("hard");
	});
});

// ---------------------------------------------------------------------------
// afenda- reserved prefix → hard
// ---------------------------------------------------------------------------

describe("applyIdentity – reserved prefix", () => {
	it("rejects id starting with afenda-", () => {
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [{ id: "afenda-x", label: "Q1" }],
		};
		const result = applyIdentity(rows, null, "create");
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0].code).toBe("reserved_id");
		expect(result.issues[0].severity).toBe("hard");
	});

	it("rejects id with NFKC-normalised afenda- prefix", () => {
		// Full-width 'a' normalises to 'a'
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [{ id: "AFENDA-foo", label: "Q1" }],
		};
		const result = applyIdentity(rows, null, "create");
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0].code).toBe("reserved_id");
	});
});

// ---------------------------------------------------------------------------
// other passthrough fields preserved
// ---------------------------------------------------------------------------

describe("applyIdentity – field passthrough", () => {
	it("preserves non-id fields", () => {
		const rows: ParsedEntityRows = {
			...emptyRows(),
			items: [{ id: null, label: "My Label", type: "text", extra: 42 }],
		};
		const result = applyIdentity(rows, null, "create");
		const item = result.documentPartial.items[0];
		expect(item.label).toBe("My Label");
		expect(item.type).toBe("text");
		expect(item.extra).toBe(42);
	});
});

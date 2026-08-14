import { describe, expect, it } from "vitest";
import { canonicalizeDocumentOrder } from "@/lib/instrument-order";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDoc = any;

describe("canonicalizeDocumentOrder", () => {
	it("renumbers item order to 1..n per section (from brief verbatim)", () => {
		const out = canonicalizeDocumentOrder({
			sections: [{ id: "s1", title: "A", order: 10, itemIds: ["b", "a"] }],
			items: [
				{ type: "info", id: "a", body: "x" },
				{ type: "info", id: "b", body: "y" },
			],
			dimensions: [],
		} as AnyDoc);
		expect(out.sections[0].order).toBe(1);
		expect(out.sections[0].itemIds).toEqual(["b", "a"]); // existing itemIds order preserved then rewritten from items.order if present
	});

	it("renumbers sections 1..n sorted by numeric order, blank last", () => {
		const out = canonicalizeDocumentOrder({
			sections: [
				{ id: "s2", title: "B", order: 20, itemIds: [] },
				{ id: "s1", title: "A", order: 10, itemIds: [] },
			],
			items: [],
			dimensions: [],
		} as AnyDoc);
		expect(out.sections[0].id).toBe("s1");
		expect(out.sections[0].order).toBe(1);
		expect(out.sections[1].id).toBe("s2");
		expect(out.sections[1].order).toBe(2);
	});

	it("renumbers dimensions 1..n sorted by numeric order", () => {
		const out = canonicalizeDocumentOrder({
			sections: [],
			items: [],
			dimensions: [
				{ id: "d2", code: "D2", name: "Dim 2", order: 30 },
				{ id: "d1", code: "D1", name: "Dim 1", order: 10 },
			],
		} as AnyDoc);
		expect(out.dimensions![0].id).toBe("d1");
		expect(out.dimensions![0].order).toBe(1);
		expect(out.dimensions![1].id).toBe("d2");
		expect(out.dimensions![1].order).toBe(2);
	});

	it("sorts items by explicit item.order within section, rebuilds itemIds", () => {
		const out = canonicalizeDocumentOrder({
			sections: [{ id: "s1", title: "A", order: 1, itemIds: ["a", "b"] }],
			items: [
				{ type: "info", id: "a", body: "x", order: 20 },
				{ type: "info", id: "b", body: "y", order: 10 },
			],
			dimensions: [],
		} as AnyDoc);
		// b has lower order so it comes first
		expect(out.sections[0].itemIds).toEqual(["b", "a"]);
		const bItem = out.items.find((i: { id: string }) => i.id === "b");
		const aItem = out.items.find((i: { id: string }) => i.id === "a");
		expect(bItem?.order).toBe(1);
		expect(aItem?.order).toBe(2);
	});

	it("derives item order from itemIds index when item.order is absent", () => {
		const out = canonicalizeDocumentOrder({
			sections: [{ id: "s1", title: "A", order: 1, itemIds: ["b", "a"] }],
			items: [
				{ type: "info", id: "a", body: "x" },
				{ type: "info", id: "b", body: "y" },
			],
			dimensions: [],
		} as AnyDoc);
		// itemIds is ["b","a"] so b=index 0, a=index 1 → b gets order 1, a gets order 2
		expect(out.sections[0].itemIds).toEqual(["b", "a"]);
		const bItem = out.items.find((i: { id: string }) => i.id === "b");
		const aItem = out.items.find((i: { id: string }) => i.id === "a");
		expect(bItem?.order).toBe(1);
		expect(aItem?.order).toBe(2);
	});

	it("handles section with no order (undefined/NaN) by placing it last", () => {
		const out = canonicalizeDocumentOrder({
			sections: [
				{ id: "s2", title: "B", order: undefined as unknown as number, itemIds: [] },
				{ id: "s1", title: "A", order: 5, itemIds: [] },
			],
			items: [],
			dimensions: [],
		} as AnyDoc);
		expect(out.sections[0].id).toBe("s1");
		expect(out.sections[1].id).toBe("s2");
	});

	it("works without dimensions field (optional)", () => {
		const out = canonicalizeDocumentOrder({
			sections: [{ id: "s1", title: "A", order: 1, itemIds: [] }],
			items: [],
		} as AnyDoc);
		expect(out.sections[0].order).toBe(1);
	});
});

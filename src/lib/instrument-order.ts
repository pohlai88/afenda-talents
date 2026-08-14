/**
 * Canonicalize section/dimension/item order for draft documents.
 * Sorts sections and dimensions by numeric `order` (undefined/NaN sorts last),
 * then renumbers them 1..n. Per section, sorts items by item.order if present
 * (falling back to itemIds index), sets item.order 1..n, and rebuilds itemIds.
 */

type WithId = { id: string };
type WithOrder = { order: number };
type Section = { id: string; order: number; itemIds: string[] };
type Dimension = { id: string; order: number };
type Item = { id: string; order?: number };

type Document = {
	sections: Section[];
	items: Item[];
	dimensions?: Dimension[];
};

function numericOrder(value: number | undefined): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function sortByOrder<T extends WithId & Partial<WithOrder>>(arr: T[]): T[] {
	return [...arr].sort((a, b) => numericOrder(a.order) - numericOrder(b.order));
}

export function canonicalizeDocumentOrder<T extends Document>(doc: T): T {
	// Sort and renumber sections
	const sortedSections = sortByOrder(doc.sections).map((section, idx) => ({
		...section,
		order: idx + 1,
	}));

	// Sort and renumber dimensions (if present)
	const sortedDimensions = doc.dimensions
		? sortByOrder(doc.dimensions).map((dim, idx) => ({ ...dim, order: idx + 1 }))
		: doc.dimensions;

	// Build a map of item.order by id from original items
	const itemOrderById = new Map<string, number | undefined>();
	for (const item of doc.items) {
		itemOrderById.set(item.id, item.order);
	}

	// For each section, determine item sort order and set item.order 1..n
	// Track final order for all items
	const itemFinalOrder = new Map<string, number>();

	const rebuiltSections = sortedSections.map((section) => {
		// Sort items in this section: use item.order if present, else use itemIds index
		const sectionItemIds = section.itemIds;
		const sortedIds = [...sectionItemIds].sort((idA, idB) => {
			const oA = itemOrderById.get(idA);
			const oB = itemOrderById.get(idB);
			const hasA = oA !== undefined;
			const hasB = oB !== undefined;
			if (hasA && hasB) return numericOrder(oA) - numericOrder(oB);
			// If neither has order, preserve itemIds original relative order
			if (!hasA && !hasB) return sectionItemIds.indexOf(idA) - sectionItemIds.indexOf(idB);
			// If one has order, items without order come after
			if (hasA) return -1;
			return 1;
		});

		// Assign 1..n order per section
		sortedIds.forEach((id, idx) => {
			itemFinalOrder.set(id, idx + 1);
		});

		return { ...section, itemIds: sortedIds };
	});

	// Rebuild items array with updated order
	const rebuiltItems = doc.items.map((item) => {
		const newOrder = itemFinalOrder.get(item.id);
		if (newOrder !== undefined) {
			return { ...item, order: newOrder };
		}
		return item;
	});

	return {
		...doc,
		sections: rebuiltSections,
		...(sortedDimensions !== undefined ? { dimensions: sortedDimensions } : {}),
		items: rebuiltItems,
	};
}

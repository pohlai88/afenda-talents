/**
 * Structural diff between a merged (incoming) instrument document and a target
 * (current draft). Pure module — no Prisma, no routes.
 *
 * Classification rules per spec §6.4 / §8 and task brief:
 *   - Diff base is `target`. `target` null/undefined → create path.
 *   - Compare by entity id, not array index.
 *   - Item wording fields (text/body/labels/helperText/required) → "copy"
 *   - Item scoring fields (scored/dimensionId/reverseScored/min/max/type) → "breaking"
 *   - Item add/remove → "breaking"
 *   - Section/dimension order permutation only → "order"
 *   - Consent text → "copy"
 *   - Top-level meta (title, candidateIntroduction, estimatedMinutes, …) → "meta"
 *   - responseContextRules label/explanation/enabled only → "invisible"
 *   - responseContextRules scoring logic (itemIds/pairs/threshold/runLength/type) → "breaking"
 */

import { canonicalizeDocumentOrder } from "@/lib/instrument-order";
import { assertInstrumentInvariants } from "@/lib/instrument-invariants";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DiffEntry = {
	path: string;
	entityType: "item" | "section" | "dimension" | "band" | "consent" | "meta" | "rule";
	entityId?: string;
	change: "copy" | "breaking" | "order" | "meta" | "invisible";
	before?: unknown;
	after?: unknown;
};

export type InstrumentDiff = {
	summary: {
		breaking: boolean;
		orderOnly: boolean;
		unreachableBands: boolean;
		itemCountChanged: boolean;
		staleBase: boolean;
		invisibleFieldRevert: boolean;
		contextRulesSheetDrift: boolean;
	};
	entries: DiffEntry[];
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type AnyRecord = Record<string, unknown>;

function asRecord(v: unknown): AnyRecord {
	if (typeof v === "object" && v !== null) return v as AnyRecord;
	return {};
}

function safeArray(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}

function safeString(v: unknown): string {
	return typeof v === "string" ? v : "";
}

function jsonEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** Item fields that are wording-only (copy change). */
const ITEM_COPY_FIELDS = new Set(["text", "body", "labels", "helperText", "required"]);

/** Item fields that affect scoring (breaking change). */
const ITEM_BREAKING_FIELDS = new Set([
	"type",
	"scored",
	"dimensionId",
	"reverseScored",
	"min",
	"max",
	"maxLength",
]);

/** Rule fields that are display-only (invisible change). */
const RULE_DISPLAY_FIELDS = new Set(["label", "managerExplanation", "enabled"]);

/** Rule fields that affect scoring logic (breaking change). */
const RULE_SCORING_FIELDS = new Set(["type", "itemIds", "pairs", "threshold", "runLength"]);

/** Top-level meta fields (meta change, non-breaking). */
const META_FIELDS = new Set([
	"title",
	"internalDescription",
	"candidateIntroduction",
	"estimatedMinutes",
	"displayMode",
	"scoringMode",
	"schemaVersion",
]);

// ---------------------------------------------------------------------------
// Section/dimension comparison helpers
// ---------------------------------------------------------------------------

type CanonSection = { id: string; order: number; itemIds: string[]; [k: string]: unknown };
type CanonDimension = { id: string; order: number; [k: string]: unknown };

function canonDoc(doc: unknown): AnyRecord {
	if (doc == null) return {};
	try {
		return asRecord(canonicalizeDocumentOrder(doc as Parameters<typeof canonicalizeDocumentOrder>[0]));
	} catch {
		return asRecord(doc);
	}
}

// ---------------------------------------------------------------------------
// Diff implementations
// ---------------------------------------------------------------------------

function diffItems(
	mergedItems: unknown[],
	targetItems: unknown[],
	entries: DiffEntry[],
): { breaking: boolean; itemCountChanged: boolean } {
	const targetById = new Map<string, AnyRecord>();
	for (const item of targetItems) {
		const r = asRecord(item);
		const id = safeString(r.id);
		if (id) targetById.set(id, r);
	}

	const mergedById = new Map<string, AnyRecord>();
	for (const item of mergedItems) {
		const r = asRecord(item);
		const id = safeString(r.id);
		if (id) mergedById.set(id, r);
	}

	let breaking = false;
	const itemCountChanged = mergedItems.length !== targetItems.length;

	// Items in merged but not in target → added (breaking)
	for (const [id, mergedItem] of mergedById) {
		if (!targetById.has(id)) {
			entries.push({
				path: `items[id=${id}]`,
				entityType: "item",
				entityId: id,
				change: "breaking",
				before: undefined,
				after: mergedItem,
			});
			breaking = true;
		}
	}

	// Items in target but not in merged → removed (breaking)
	for (const [id, targetItem] of targetById) {
		if (!mergedById.has(id)) {
			entries.push({
				path: `items[id=${id}]`,
				entityType: "item",
				entityId: id,
				change: "breaking",
				before: targetItem,
				after: undefined,
			});
			breaking = true;
		}
	}

	// Items present in both → compare fields
	for (const [id, mergedItem] of mergedById) {
		const targetItem = targetById.get(id);
		if (!targetItem) continue;

		// Determine changed fields
		const allFields = new Set([...Object.keys(mergedItem), ...Object.keys(targetItem)]);
		allFields.delete("id");
		allFields.delete("order"); // order handled separately

		let hasBreaking = false;
		let hasCopy = false;

		for (const field of allFields) {
			if (jsonEqual(mergedItem[field], targetItem[field])) continue;

			if (ITEM_BREAKING_FIELDS.has(field)) {
				hasBreaking = true;
			} else if (ITEM_COPY_FIELDS.has(field)) {
				hasCopy = true;
			}
			// unknown fields treated as breaking
			else if (!ITEM_COPY_FIELDS.has(field) && !ITEM_BREAKING_FIELDS.has(field)) {
				hasBreaking = true;
			}
		}

		if (hasBreaking) {
			entries.push({
				path: `items[id=${id}]`,
				entityType: "item",
				entityId: id,
				change: "breaking",
				before: targetItem,
				after: mergedItem,
			});
			breaking = true;
		} else if (hasCopy) {
			entries.push({
				path: `items[id=${id}]`,
				entityType: "item",
				entityId: id,
				change: "copy",
				before: targetItem,
				after: mergedItem,
			});
		}
	}

	return { breaking, itemCountChanged };
}

function diffSections(
	mergedSections: unknown[],
	targetSections: unknown[],
	entries: DiffEntry[],
): { breaking: boolean } {
	const targetById = new Map<string, CanonSection>();
	for (const s of targetSections) {
		const r = asRecord(s) as CanonSection;
		if (r.id) targetById.set(r.id, r);
	}
	const mergedById = new Map<string, CanonSection>();
	for (const s of mergedSections) {
		const r = asRecord(s) as CanonSection;
		if (r.id) mergedById.set(r.id, r);
	}

	let breaking = false;

	// Added sections
	for (const [id, section] of mergedById) {
		if (!targetById.has(id)) {
			entries.push({
				path: `sections[id=${id}]`,
				entityType: "section",
				entityId: id,
				change: "breaking",
				before: undefined,
				after: section,
			});
			breaking = true;
		}
	}

	// Removed sections
	for (const [id, section] of targetById) {
		if (!mergedById.has(id)) {
			entries.push({
				path: `sections[id=${id}]`,
				entityType: "section",
				entityId: id,
				change: "breaking",
				before: section,
				after: undefined,
			});
			breaking = true;
		}
	}

	// Existing sections
	for (const [id, mergedSection] of mergedById) {
		const targetSection = targetById.get(id);
		if (!targetSection) continue;

		// Check non-order fields (title, introduction, etc.)
		const nonOrderFields = ["title", "introduction"] as const;
		let hasWording = false;
		let hasStructural = false;

		for (const field of nonOrderFields) {
			if (!jsonEqual(mergedSection[field], targetSection[field])) {
				hasWording = true;
			}
		}

		// itemIds change that isn't just ordering is structural (breaking)
		const mergedIds = [...mergedSection.itemIds].sort();
		const targetIds = [...targetSection.itemIds].sort();
		const itemSetChanged = !jsonEqual(mergedIds, targetIds);
		if (itemSetChanged) {
			hasStructural = true;
		}

		// Order number changed
		const orderChanged = mergedSection.order !== targetSection.order;
		// itemIds sequence changed (same set, different order)
		const itemOrderChanged =
			!itemSetChanged && !jsonEqual(mergedSection.itemIds, targetSection.itemIds);

		if (hasStructural) {
			entries.push({
				path: `sections[id=${id}]`,
				entityType: "section",
				entityId: id,
				change: "breaking",
				before: targetSection,
				after: mergedSection,
			});
			breaking = true;
		} else if (orderChanged || itemOrderChanged) {
			entries.push({
				path: `sections[id=${id}]`,
				entityType: "section",
				entityId: id,
				change: "order",
				before: targetSection,
				after: mergedSection,
			});
		} else if (hasWording) {
			entries.push({
				path: `sections[id=${id}].title`,
				entityType: "section",
				entityId: id,
				change: "copy",
				before: targetSection,
				after: mergedSection,
			});
		}
	}

	return { breaking };
}

function diffDimensions(
	mergedDims: unknown[],
	targetDims: unknown[],
	entries: DiffEntry[],
): { breaking: boolean; hasOrderEntries: boolean } {
	const targetById = new Map<string, CanonDimension>();
	for (const d of targetDims) {
		const r = asRecord(d) as CanonDimension;
		if (r.id) targetById.set(r.id, r);
	}
	const mergedById = new Map<string, CanonDimension>();
	for (const d of mergedDims) {
		const r = asRecord(d) as CanonDimension;
		if (r.id) mergedById.set(r.id, r);
	}

	let breaking = false;
	let hasOrderEntries = false;

	for (const [id, dim] of mergedById) {
		if (!targetById.has(id)) {
			entries.push({
				path: `dimensions[id=${id}]`,
				entityType: "dimension",
				entityId: id,
				change: "breaking",
				before: undefined,
				after: dim,
			});
			breaking = true;
		}
	}
	for (const [id, dim] of targetById) {
		if (!mergedById.has(id)) {
			entries.push({
				path: `dimensions[id=${id}]`,
				entityType: "dimension",
				entityId: id,
				change: "breaking",
				before: dim,
				after: undefined,
			});
			breaking = true;
		}
	}
	for (const [id, mergedDim] of mergedById) {
		const targetDim = targetById.get(id);
		if (!targetDim) continue;
		const orderChanged = mergedDim.order !== targetDim.order;
		const otherFields = Object.keys({ ...mergedDim, ...targetDim }).filter(
			(k) => k !== "id" && k !== "order",
		);
		let hasOtherChange = false;
		for (const f of otherFields) {
			if (!jsonEqual(mergedDim[f], targetDim[f])) hasOtherChange = true;
		}
		if (hasOtherChange) {
			entries.push({
				path: `dimensions[id=${id}]`,
				entityType: "dimension",
				entityId: id,
				change: "breaking",
				before: targetDim,
				after: mergedDim,
			});
			breaking = true;
		} else if (orderChanged) {
			entries.push({
				path: `dimensions[id=${id}]`,
				entityType: "dimension",
				entityId: id,
				change: "order",
				before: targetDim,
				after: mergedDim,
			});
			hasOrderEntries = true;
		}
	}

	return { breaking, hasOrderEntries };
}

function diffBands(
	mergedBands: unknown[],
	targetBands: unknown[],
	entries: DiffEntry[],
): { breaking: boolean } {
	if (jsonEqual(mergedBands, targetBands)) return { breaking: false };

	const targetById = new Map<string, AnyRecord>();
	for (const b of targetBands) {
		const r = asRecord(b);
		if (r.id) targetById.set(safeString(r.id), r);
	}
	const mergedById = new Map<string, AnyRecord>();
	for (const b of mergedBands) {
		const r = asRecord(b);
		if (r.id) mergedById.set(safeString(r.id), r);
	}

	let breaking = false;

	for (const [id, band] of mergedById) {
		if (!targetById.has(id)) {
			entries.push({
				path: `bands[id=${id}]`,
				entityType: "band",
				entityId: id,
				change: "breaking",
				before: undefined,
				after: band,
			});
			breaking = true;
		}
	}
	for (const [id, band] of targetById) {
		if (!mergedById.has(id)) {
			entries.push({
				path: `bands[id=${id}]`,
				entityType: "band",
				entityId: id,
				change: "breaking",
				before: band,
				after: undefined,
			});
			breaking = true;
		}
	}
	for (const [id, mergedBand] of mergedById) {
		const targetBand = targetById.get(id);
		if (!targetBand) continue;
		if (!jsonEqual(mergedBand, targetBand)) {
			entries.push({
				path: `bands[id=${id}]`,
				entityType: "band",
				entityId: id,
				change: "breaking",
				before: targetBand,
				after: mergedBand,
			});
			breaking = true;
		}
	}

	return { breaking };
}

function diffRules(
	mergedRules: unknown[],
	targetRules: unknown[],
	entries: DiffEntry[],
): { breaking: boolean; invisibleFieldRevert: boolean } {
	if (jsonEqual(mergedRules, targetRules)) return { breaking: false, invisibleFieldRevert: false };

	const targetById = new Map<string, AnyRecord>();
	for (const r of targetRules) {
		const rec = asRecord(r);
		if (rec.id) targetById.set(safeString(rec.id), rec);
	}
	const mergedById = new Map<string, AnyRecord>();
	for (const r of mergedRules) {
		const rec = asRecord(r);
		if (rec.id) mergedById.set(safeString(rec.id), rec);
	}

	let breaking = false;
	let invisibleFieldRevert = false;

	for (const [id, rule] of mergedById) {
		if (!targetById.has(id)) {
			entries.push({
				path: `responseContextRules[id=${id}]`,
				entityType: "rule",
				entityId: id,
				change: "breaking",
				before: undefined,
				after: rule,
			});
			breaking = true;
			invisibleFieldRevert = true;
		}
	}
	for (const [id, rule] of targetById) {
		if (!mergedById.has(id)) {
			entries.push({
				path: `responseContextRules[id=${id}]`,
				entityType: "rule",
				entityId: id,
				change: "breaking",
				before: rule,
				after: undefined,
			});
			breaking = true;
			invisibleFieldRevert = true;
		}
	}

	for (const [id, mergedRule] of mergedById) {
		const targetRule = targetById.get(id);
		if (!targetRule) continue;
		if (jsonEqual(mergedRule, targetRule)) continue;

		const allFields = new Set([...Object.keys(mergedRule), ...Object.keys(targetRule)]);
		allFields.delete("id");

		let hasScoringChange = false;
		let hasDisplayChange = false;

		for (const field of allFields) {
			if (jsonEqual(mergedRule[field], targetRule[field])) continue;
			if (RULE_SCORING_FIELDS.has(field)) {
				hasScoringChange = true;
			} else if (RULE_DISPLAY_FIELDS.has(field)) {
				hasDisplayChange = true;
			} else {
				hasScoringChange = true;
			}
		}

		if (hasScoringChange) {
			entries.push({
				path: `responseContextRules[id=${id}]`,
				entityType: "rule",
				entityId: id,
				change: "breaking",
				before: targetRule,
				after: mergedRule,
			});
			breaking = true;
			invisibleFieldRevert = true;
		} else if (hasDisplayChange) {
			entries.push({
				path: `responseContextRules[id=${id}]`,
				entityType: "rule",
				entityId: id,
				change: "invisible",
				before: targetRule,
				after: mergedRule,
			});
			invisibleFieldRevert = true;
		}
	}

	return { breaking, invisibleFieldRevert };
}

function diffConsent(
	mergedConsent: unknown,
	targetConsent: unknown,
	entries: DiffEntry[],
): void {
	if (jsonEqual(mergedConsent, targetConsent)) return;
	entries.push({
		path: "consent",
		entityType: "consent",
		change: "copy",
		before: targetConsent,
		after: mergedConsent,
	});
}

function diffMeta(
	mergedDoc: AnyRecord,
	targetDoc: AnyRecord,
	entries: DiffEntry[],
): void {
	for (const field of META_FIELDS) {
		if (!jsonEqual(mergedDoc[field], targetDoc[field])) {
			entries.push({
				path: field,
				entityType: "meta",
				change: "meta",
				before: targetDoc[field],
				after: mergedDoc[field],
			});
		}
	}
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Diff a merged instrument document against the current target draft.
 *
 * @param merged - The incoming (uploaded / edited) document, as unknown.
 * @param target - The current target draft, or null/undefined for a create path.
 */
export function diffInstruments(merged: unknown, target: unknown): InstrumentDiff {
	const entries: DiffEntry[] = [];

	// Canonicalize both sides before comparing so order-numbering differences
	// (10/20/30 vs 1/2/3) don't produce false copy diffs.
	const mergedDoc = canonDoc(merged);
	const targetDoc = target == null ? {} : canonDoc(target);

	const mergedItems = safeArray(mergedDoc.items);
	const targetItems = safeArray(targetDoc.items);
	const mergedSections = safeArray(mergedDoc.sections);
	const targetSections = safeArray(targetDoc.sections);
	const mergedDimensions = safeArray(mergedDoc.dimensions);
	const targetDimensions = safeArray(targetDoc.dimensions);
	const mergedBands = safeArray(mergedDoc.bands);
	const targetBands = safeArray(targetDoc.bands);
	const mergedRules = safeArray(mergedDoc.responseContextRules);
	const targetRules = safeArray(targetDoc.responseContextRules);

	const itemResult = diffItems(mergedItems, targetItems, entries);
	const sectionResult = diffSections(mergedSections, targetSections, entries);
	const dimResult = diffDimensions(mergedDimensions, targetDimensions, entries);
	const bandResult = diffBands(mergedBands, targetBands, entries);
	const ruleResult = diffRules(mergedRules, targetRules, entries);

	diffConsent(mergedDoc.consent, targetDoc.consent, entries);
	diffMeta(mergedDoc, targetDoc, entries);

	const breaking =
		itemResult.breaking ||
		sectionResult.breaking ||
		dimResult.breaking ||
		bandResult.breaking ||
		ruleResult.breaking;

	// orderOnly: true only when all non-meta/consent entries are order-type, and there's at least one
	const substantiveEntries = entries.filter(
		(e) => e.entityType !== "meta" && e.entityType !== "consent",
	);
	const allOrder =
		substantiveEntries.length > 0 &&
		substantiveEntries.every((e) => e.change === "order");
	const orderOnly = !breaking && allOrder;

	// unreachableBands: check merged doc via assertInstrumentInvariants
	const invariantIssues = assertInstrumentInvariants(merged, "publish");
	const unreachableBands = invariantIssues.some((i) => i.code === "unreachable_band");

	return {
		summary: {
			breaking,
			orderOnly,
			unreachableBands,
			itemCountChanged: itemResult.itemCountChanged,
			staleBase: false,
			invisibleFieldRevert: ruleResult.invisibleFieldRevert,
			contextRulesSheetDrift: false,
		},
		entries,
	};
}

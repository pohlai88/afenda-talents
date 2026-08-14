/**
 * Shared instrument invariants — Builder parity for import and publish.
 * Pure module. No Prisma imports.
 *
 * Mode matrix (§7.4):
 *   Check                            draft    publish
 *   Duplicate entity ids             hard     hard
 *   Entity id charset / afenda-      hard     hard
 *   Dimension n=0 scored items       skip     hard
 *   Unreachable band for dimension   skip     hard
 *   Integrity: dangling refs         skip     hard
 *   Integrity: item in exactly one   skip     hard
 *   scoringMode consistency          skip     hard
 */

import { reachableScaledValues } from "@/lib/instrument-template/reachable";

export type ImportIssue = {
	severity: "hard";
	code: string;
	message: string;
	sheetRef?: string;
	path?: string;
};

/** Charset: ^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$ */
const ID_CHARSET_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

/**
 * Normalise an id for prefix checking: NFKC, trim, lowercase.
 * Per spec: must not start with `afenda-` after this normalisation.
 */
function normaliseForPrefix(id: string): string {
	return id.normalize("NFKC").trim().toLowerCase();
}

function checkIdCharset(id: string, path: string, issues: ImportIssue[]): void {
	if (!ID_CHARSET_RE.test(id)) {
		issues.push({
			severity: "hard",
			code: "invalid_id_charset",
			message: `Id "${id}" does not match required charset ^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$`,
			path,
		});
		return;
	}
	if (normaliseForPrefix(id).startsWith("afenda-")) {
		issues.push({
			severity: "hard",
			code: "reserved_prefix",
			message: `Id "${id}" starts with reserved prefix "afenda-"`,
			path,
		});
	}
}

function safeArray(val: unknown): unknown[] {
	return Array.isArray(val) ? val : [];
}

function safeString(val: unknown): string {
	return typeof val === "string" ? val : "";
}

/**
 * Run shared invariant checks against an instrument document.
 * Accepts `unknown` so it can be called before or after Zod parse.
 * Returns an empty array when all checks pass.
 */
export function assertInstrumentInvariants(
	doc: unknown,
	mode: "draft" | "publish",
): ImportIssue[] {
	const issues: ImportIssue[] = [];

	if (typeof doc !== "object" || doc === null) {
		issues.push({
			severity: "hard",
			code: "invalid_document",
			message: "Document must be a non-null object",
		});
		return issues;
	}

	const d = doc as Record<string, unknown>;

	const items = safeArray(d.items);
	const sections = safeArray(d.sections);
	const dimensions = safeArray(d.dimensions);
	const bands = safeArray(d.bands);
	const responseContextRules = safeArray(d.responseContextRules);
	const scoringMode = safeString(d.scoringMode);

	// -------------------------------------------------------------------
	// 1. Collect all entity ids and check charset + duplicates
	// -------------------------------------------------------------------

	const allIds: { id: string; path: string }[] = [];

	for (const [i, item] of items.entries()) {
		if (typeof item === "object" && item !== null) {
			const id = safeString((item as Record<string, unknown>).id);
			if (id) allIds.push({ id, path: `items[${i}].id` });
		}
	}
	for (const [i, section] of sections.entries()) {
		if (typeof section === "object" && section !== null) {
			const id = safeString((section as Record<string, unknown>).id);
			if (id) allIds.push({ id, path: `sections[${i}].id` });
		}
	}
	for (const [i, dim] of dimensions.entries()) {
		if (typeof dim === "object" && dim !== null) {
			const id = safeString((dim as Record<string, unknown>).id);
			if (id) allIds.push({ id, path: `dimensions[${i}].id` });
		}
	}
	for (const [i, band] of bands.entries()) {
		if (typeof band === "object" && band !== null) {
			const id = safeString((band as Record<string, unknown>).id);
			if (id) allIds.push({ id, path: `bands[${i}].id` });
		}
	}
	for (const [i, rule] of responseContextRules.entries()) {
		if (typeof rule === "object" && rule !== null) {
			const id = safeString((rule as Record<string, unknown>).id);
			if (id) allIds.push({ id, path: `responseContextRules[${i}].id` });
		}
	}

	// Charset check
	for (const { id, path } of allIds) {
		checkIdCharset(id, path, issues);
	}

	// Duplicate check per entity collection
	function checkDuplicates(entities: unknown[], entityPath: string) {
		const seen = new Set<string>();
		for (const entity of entities) {
			if (typeof entity !== "object" || entity === null) continue;
			const id = safeString((entity as Record<string, unknown>).id);
			if (!id) continue;
			if (seen.has(id)) {
				issues.push({
					severity: "hard",
					code: "duplicate_id",
					message: `Duplicate id "${id}" in ${entityPath}`,
					path: entityPath,
				});
			}
			seen.add(id);
		}
	}

	checkDuplicates(items, "items");
	checkDuplicates(sections, "sections");
	checkDuplicates(dimensions, "dimensions");
	checkDuplicates(bands, "bands");
	checkDuplicates(responseContextRules, "responseContextRules");

	// -------------------------------------------------------------------
	// Publish-only checks
	// -------------------------------------------------------------------
	if (mode === "draft") {
		return issues;
	}

	// -------------------------------------------------------------------
	// 2. n=0: dimensional scoring must not have dimension with zero scored items
	// -------------------------------------------------------------------
	if (scoringMode === "dimensional") {
		const itemSet = new Map<string, unknown>();
		for (const item of items) {
			if (typeof item === "object" && item !== null) {
				const r = item as Record<string, unknown>;
				itemSet.set(safeString(r.id), item);
			}
		}

		for (const [di, dim] of dimensions.entries()) {
			if (typeof dim !== "object" || dim === null) continue;
			const dimId = safeString((dim as Record<string, unknown>).id);
			const n = items.filter((item) => {
				if (typeof item !== "object" || item === null) return false;
				const r = item as Record<string, unknown>;
				return r.type === "scale" && r.scored === true && safeString(r.dimensionId) === dimId;
			}).length;

			if (n === 0) {
				issues.push({
					severity: "hard",
					code: "dim_n_zero",
					message: `Dimension "${dimId}" has zero scored scale items (would divide by zero in scaleDimensionRaw)`,
					path: `dimensions[${di}]`,
				});
			}
		}
	}

	// -------------------------------------------------------------------
	// 3. Unreachable bands
	// -------------------------------------------------------------------
	if (scoringMode === "dimensional") {
		for (const dim of dimensions) {
			if (typeof dim !== "object" || dim === null) continue;
			const dimId = safeString((dim as Record<string, unknown>).id);
			const n = items.filter((item) => {
				if (typeof item !== "object" || item === null) return false;
				const r = item as Record<string, unknown>;
				return r.type === "scale" && r.scored === true && safeString(r.dimensionId) === dimId;
			}).length;

			if (n < 1) continue; // already flagged by n=0 check

			const reachable = new Set(reachableScaledValues(n));

			for (const [bi, band] of bands.entries()) {
				if (typeof band !== "object" || band === null) continue;
				const b = band as Record<string, unknown>;
				const bandId = safeString(b.id);
				const min = typeof b.minScaled === "number" ? b.minScaled : null;
				const max = typeof b.maxScaled === "number" ? b.maxScaled : null;
				if (min === null || max === null) continue;

				const hasReachable = [...reachable].some((v) => v >= min && v <= max);
				if (!hasReachable) {
					issues.push({
						severity: "hard",
						code: "unreachable_band",
						message: `Band "${bandId}" (${min}–${max}) contains no reachable scaled value for dimension "${dimId}" (n=${n})`,
						path: `bands[${bi}]`,
					});
				}
			}
		}
	}

	// -------------------------------------------------------------------
	// 4. Integrity: dangling references in sections.itemIds
	// -------------------------------------------------------------------
	const itemIds = new Set(
		items
			.filter((i) => typeof i === "object" && i !== null)
			.map((i) => safeString((i as Record<string, unknown>).id)),
	);
	const dimIds = new Set(
		dimensions
			.filter((d) => typeof d === "object" && d !== null)
			.map((d) => safeString((d as Record<string, unknown>).id)),
	);

	// Track how many sections reference each item (must be exactly one).
	const itemSectionCount = new Map<string, number>();
	for (const [si, section] of sections.entries()) {
		if (typeof section !== "object" || section === null) continue;
		const s = section as Record<string, unknown>;
		const sItemIds = safeArray(s.itemIds);
		for (const ref of sItemIds) {
			const refId = safeString(ref);
			if (!refId) continue;
			if (!itemIds.has(refId)) {
				issues.push({
					severity: "hard",
					code: "dangling_ref",
					message: `Section "${safeString(s.id)}" references unknown item "${refId}"`,
					path: `sections[${si}].itemIds`,
				});
			} else {
				itemSectionCount.set(refId, (itemSectionCount.get(refId) ?? 0) + 1);
				if (itemSectionCount.get(refId)! > 1) {
					issues.push({
						severity: "hard",
						code: "item_in_multiple_sections",
						message: `Item "${refId}" appears in more than one section`,
						path: `sections[${si}].itemIds`,
					});
				}
			}
		}
	}

	// Every item must appear in exactly one section
	for (const item of items) {
		if (typeof item !== "object" || item === null) continue;
		const id = safeString((item as Record<string, unknown>).id);
		if (id && !itemSectionCount.has(id)) {
			issues.push({
				severity: "hard",
				code: "item_not_in_section",
				message: `Item "${id}" does not appear in any section`,
				path: "items",
			});
		}
	}

	// Scale items: scored items must reference existing dimensionId
	for (const [ii, item] of items.entries()) {
		if (typeof item !== "object" || item === null) continue;
		const r = item as Record<string, unknown>;
		if (r.type === "scale" && r.scored === true) {
			const dimId = r.dimensionId;
			if (dimId !== null && typeof dimId === "string" && dimId && !dimIds.has(dimId)) {
				issues.push({
					severity: "hard",
					code: "dangling_ref",
					message: `Scored item "${safeString(r.id)}" references unknown dimension "${dimId}"`,
					path: `items[${ii}].dimensionId`,
				});
			}
		}
	}

	// Response context rules: itemIds and pairs must reference existing items
	for (const [ri, rule] of responseContextRules.entries()) {
		if (typeof rule !== "object" || rule === null) continue;
		const r = rule as Record<string, unknown>;
		const ruleId = safeString(r.id);
		for (const ref of safeArray(r.itemIds)) {
			const refId = safeString(ref);
			if (refId && !itemIds.has(refId)) {
				issues.push({
					severity: "hard",
					code: "dangling_ref",
					message: `Rule "${ruleId}" references unknown item "${refId}" in itemIds`,
					path: `responseContextRules[${ri}].itemIds`,
				});
			}
		}
		for (const pair of safeArray(r.pairs)) {
			for (const ref of safeArray(pair)) {
				const refId = safeString(ref);
				if (refId && !itemIds.has(refId)) {
					issues.push({
						severity: "hard",
						code: "dangling_ref",
						message: `Rule "${ruleId}" references unknown item "${refId}" in pairs`,
						path: `responseContextRules[${ri}].pairs`,
					});
				}
			}
		}
	}

	// -------------------------------------------------------------------
	// 5. scoringMode consistency
	// -------------------------------------------------------------------
	if (scoringMode === "none") {
		const hasDimensions = dimensions.length > 0;
		const hasBands = bands.length > 0;
		const hasScoredItems = items.some((item) => {
			if (typeof item !== "object" || item === null) return false;
			const r = item as Record<string, unknown>;
			return r.type === "scale" && r.scored === true;
		});

		if (hasDimensions || hasBands || hasScoredItems) {
			issues.push({
				severity: "hard",
				code: "scoring_mode_conflict",
				message:
					'scoringMode "none" must not have dimensions, bands, or scored items',
				path: "scoringMode",
			});
		}
	}

	return issues;
}

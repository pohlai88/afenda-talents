/**
 * Referential integrity checks for instrument template import.
 * Mirrors the publish-mode integrity slice of assertInstrumentInvariants
 * but is callable independently (e.g. during import, before publishing).
 *
 * Pure module. No Prisma.
 */

import type { ImportIssue } from "@/lib/instrument-invariants";

function safeArray(val: unknown): unknown[] {
	return Array.isArray(val) ? val : [];
}

function safeString(val: unknown): string {
	return typeof val === "string" ? val : "";
}

/**
 * Assert referential integrity of a (partially-built) instrument document.
 * Checks:
 *   - Dangling itemIds in sections
 *   - Items appearing in more than one section
 *   - Items not appearing in any section
 *   - Scored scale items referencing unknown dimensionId
 *
 * These match the publish-mode checks in assertInstrumentInvariants §4 / §5.6 / §7.4.
 */
export function assertReferentialIntegrity(doc: unknown): ImportIssue[] {
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
	const responseContextRules = safeArray(d.responseContextRules);

	const itemIds = new Set<string>(
		items
			.filter((i) => typeof i === "object" && i !== null)
			.map((i) => safeString((i as Record<string, unknown>).id))
			.filter(Boolean),
	);

	const dimIds = new Set<string>(
		dimensions
			.filter((d) => typeof d === "object" && d !== null)
			.map((d) => safeString((d as Record<string, unknown>).id))
			.filter(Boolean),
	);

	// Track how many sections reference each item
	const itemSectionCount = new Map<string, number>();

	for (const [si, section] of sections.entries()) {
		if (typeof section !== "object" || section === null) continue;
		const s = section as Record<string, unknown>;
		const sId = safeString(s.id);
		const sItemIds = safeArray(s.itemIds);

		for (const ref of sItemIds) {
			const refId = safeString(ref);
			if (!refId) continue;

			if (!itemIds.has(refId)) {
				issues.push({
					severity: "hard",
					code: "dangling_ref",
					message: `Section "${sId}" references unknown item "${refId}"`,
					path: `sections[${si}].itemIds`,
				});
			} else {
				const count = (itemSectionCount.get(refId) ?? 0) + 1;
				itemSectionCount.set(refId, count);
				if (count > 1) {
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

	// Scored scale items must reference existing dimensionId
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

	return issues;
}

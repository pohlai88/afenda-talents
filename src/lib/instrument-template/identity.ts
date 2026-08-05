/**
 * Identity helpers for instrument template import.
 * Mints new ids and resolves existing ones per spec §6.1.
 * Pure module. No Prisma.
 */

import { randomBytes } from "node:crypto";
import { canonicalCell } from "@/lib/instrument-template/cells";
import type { ImportIssue } from "@/lib/instrument-invariants";

export type IdPrefix = "it" | "sec" | "dim" | "bnd";

export type ParsedEntityRows = {
	items: Array<{ id: unknown; [k: string]: unknown }>;
	sections: Array<{ id: unknown; [k: string]: unknown }>;
	dimensions: Array<{ id: unknown; [k: string]: unknown }>;
	bands: Array<{ id: unknown; [k: string]: unknown }>;
};

export type SourceDoc = {
	items?: Array<{ id?: unknown; [k: string]: unknown }>;
	sections?: Array<{ id?: unknown; [k: string]: unknown }>;
	dimensions?: Array<{ id?: unknown; [k: string]: unknown }>;
	bands?: Array<{ id?: unknown; [k: string]: unknown }>;
};

export type IdentityResult = {
	documentPartial: {
		items: Array<{ id: string; [k: string]: unknown }>;
		sections: Array<{ id: string; [k: string]: unknown }>;
		dimensions: Array<{ id: string; [k: string]: unknown }>;
		bands: Array<{ id: string; [k: string]: unknown }>;
	};
	issues: ImportIssue[];
};

/** Charset: ^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$ */
const ID_CHARSET_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export function mintId(prefix: IdPrefix): string {
	return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function normaliseForPrefix(id: string): string {
	return id.normalize("NFKC").trim().toLowerCase();
}

function extractSourceIds(doc: SourceDoc | null, key: keyof SourceDoc): Set<string> {
	if (!doc) return new Set();
	const arr = doc[key];
	if (!Array.isArray(arr)) return new Set();
	const ids = new Set<string>();
	for (const row of arr) {
		if (typeof row === "object" && row !== null) {
			const id = (row as Record<string, unknown>).id;
			if (typeof id === "string" && id) ids.add(id);
		}
	}
	return ids;
}

function processCollection(
	rows: Array<{ id: unknown; [k: string]: unknown }>,
	prefix: IdPrefix,
	sourceIds: Set<string>,
	phase: "create" | "update",
	entityLabel: string,
	issues: ImportIssue[],
): Array<{ id: string; [k: string]: unknown }> {
	const resolved: Array<{ id: string; [k: string]: unknown }> = [];
	const seenIds = new Map<string, number[]>(); // id -> indices in resolved

	for (const [rowIdx, row] of rows.entries()) {
		const cellResult = canonicalCell(row.id, "id");

		if (!cellResult.ok) {
			// scientific_notation or invalid
			issues.push({
				severity: "hard",
				code: cellResult.issue === "scientific_notation" ? "scientific_notation" : "invalid_id",
				message:
					cellResult.issue === "scientific_notation"
						? `Id at ${entityLabel}[${rowIdx}] is in scientific notation — use a plain string`
						: `Id at ${entityLabel}[${rowIdx}] is invalid`,
				path: `${entityLabel}[${rowIdx}].id`,
			});
			// push a placeholder so indices stay aligned; will be skipped by integrity check
			resolved.push({ ...row, id: `__error_${rowIdx}` });
			continue;
		}

		const rawId = cellResult.value as string | null;

		if (rawId === null || rawId === "") {
			// Mint
			resolved.push({ ...row, id: mintId(prefix) });
			continue;
		}

		// Charset check
		if (!ID_CHARSET_RE.test(rawId)) {
			issues.push({
				severity: "hard",
				code: "invalid_id",
				message: `Id "${rawId}" at ${entityLabel}[${rowIdx}] does not match required charset ^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$`,
				path: `${entityLabel}[${rowIdx}].id`,
			});
			resolved.push({ ...row, id: rawId });
			continue;
		}

		// Reserved prefix check
		if (normaliseForPrefix(rawId).startsWith("afenda-")) {
			issues.push({
				severity: "hard",
				code: "reserved_id",
				message: `Id "${rawId}" at ${entityLabel}[${rowIdx}] starts with reserved prefix "afenda-"`,
				path: `${entityLabel}[${rowIdx}].id`,
			});
			resolved.push({ ...row, id: rawId });
			continue;
		}

		// Update phase: populated id must exist in sourceDoc
		if (phase === "update" && !sourceIds.has(rawId)) {
			issues.push({
				severity: "hard",
				code: "unknown_id",
				message: `Id "${rawId}" at ${entityLabel}[${rowIdx}] does not exist in source document — new rows must leave id blank`,
				path: `${entityLabel}[${rowIdx}].id`,
			});
			resolved.push({ ...row, id: rawId });
			continue;
		}

		// Track for duplicate detection
		const currentIdx = resolved.length;
		resolved.push({ ...row, id: rawId });

		const existing = seenIds.get(rawId);
		if (existing) {
			existing.push(currentIdx);
		} else {
			seenIds.set(rawId, [currentIdx]);
		}
	}

	// Duplicate check — emit issue for every colliding row
	for (const [id, indices] of seenIds) {
		if (indices.length > 1) {
			for (const idx of indices) {
				issues.push({
					severity: "hard",
					code: "duplicate_id",
					message: `Duplicate id "${id}" in ${entityLabel}`,
					path: `${entityLabel}[${idx}].id`,
				});
			}
		}
	}

	return resolved;
}

export function applyIdentity(
	parsedRows: ParsedEntityRows,
	sourceDoc: SourceDoc | null,
	phase: "create" | "update",
): IdentityResult {
	const issues: ImportIssue[] = [];

	const sourceItemIds = extractSourceIds(sourceDoc, "items");
	const sourceSectionIds = extractSourceIds(sourceDoc, "sections");
	const sourceDimensionIds = extractSourceIds(sourceDoc, "dimensions");
	const sourceBandIds = extractSourceIds(sourceDoc, "bands");

	const items = processCollection(parsedRows.items, "it", sourceItemIds, phase, "items", issues);
	const sections = processCollection(parsedRows.sections, "sec", sourceSectionIds, phase, "sections", issues);
	const dimensions = processCollection(parsedRows.dimensions, "dim", sourceDimensionIds, phase, "dimensions", issues);
	const bands = processCollection(parsedRows.bands, "bnd", sourceBandIds, phase, "bands", issues);

	return {
		documentPartial: { items, sections, dimensions, bands },
		issues,
	};
}

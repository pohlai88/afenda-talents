/**
 * Issue formatting helpers for instrument template import.
 * Pure module. No Prisma.
 */

import type { ImportIssue } from "@/lib/instrument-invariants";

/**
 * Provenance map: entity+row/col → sheet cell reference like "Items!F14".
 * Keys are in the form `${entity}[${rowIndex}]` or `${entity}[${rowIndex}].${field}`.
 */
export type ProvenanceMap = Map<string, string>;

/**
 * Format an ImportIssue into a human-readable string with a sheet reference.
 *
 * Priority:
 * 1. If issue.sheetRef is already set, return it.
 * 2. Look up issue.path in provenance map.
 * 3. Fall back to issue.path, then issue.code.
 */
export function formatIssue(issue: ImportIssue, provenance: ProvenanceMap): string {
	if (issue.sheetRef) {
		return issue.sheetRef;
	}

	if (issue.path) {
		const ref = provenance.get(issue.path);
		if (ref) {
			return ref;
		}
		return issue.path;
	}

	return issue.code;
}

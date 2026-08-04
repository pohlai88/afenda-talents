/**
 * Normalize stored Result JSON for UI (legacy ValidityFlag vs ResponseContextOutcome).
 */
import type { Band } from "@/lib/instrument-labels";
import type {
	DimensionScore,
	ResponseContextOutcome,
	ValidityFlag,
} from "@/lib/scoring";

export type UiDimension = {
	id?: string;
	code: string;
	raw: number;
	scaled: number;
	band: Band;
};

export type UiContextFlag = {
	key: string;
	label: string;
	triggered: boolean;
	reason: string;
};

function isOutcome(value: unknown): value is ResponseContextOutcome {
	return (
		!!value &&
		typeof value === "object" &&
		"ruleId" in value &&
		"type" in value &&
		"triggered" in value
	);
}

function isLegacyFlag(value: unknown): value is ValidityFlag {
	return (
		!!value &&
		typeof value === "object" &&
		"code" in value &&
		"triggered" in value &&
		!("ruleId" in value)
	);
}

export function normalizeDimensions(raw: unknown): UiDimension[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((d) => {
		const row = d as DimensionScore & { band: Band | { name: string } };
		const bandName =
			typeof row.band === "string" ? row.band : (row.band?.name ?? "Effective");
		return {
			id: row.id,
			code: row.code,
			raw: row.raw,
			scaled: row.scaled,
			band: bandName as Band,
		};
	});
}

export function normalizeContextFlags(raw: unknown): UiContextFlag[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((f) => {
		if (isOutcome(f)) {
			return {
				key: f.ruleId,
				label: f.label,
				triggered: f.triggered,
				reason: f.reason,
			};
		}
		if (isLegacyFlag(f)) {
			return {
				key: f.code,
				label: f.code,
				triggered: f.triggered,
				reason: f.reason,
			};
		}
		return {
			key: "unknown",
			label: "Unknown",
			triggered: false,
			reason: "",
		};
	});
}

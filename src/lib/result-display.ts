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

const BANDS = new Set<Band>(["Developing", "Effective", "Strong"]);

function asBand(value: unknown): Band {
	if (typeof value === "string" && BANDS.has(value as Band)) return value as Band;
	if (value && typeof value === "object" && "name" in value) {
		const name = (value as { name: unknown }).name;
		if (typeof name === "string" && BANDS.has(name as Band)) return name as Band;
	}
	return "Effective";
}

export function normalizeDimensions(raw: unknown): UiDimension[] {
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((d) => {
		if (!d || typeof d !== "object") return [];
		const row = d as Partial<DimensionScore> & { band?: Band | { name: string } };
		if (typeof row.code !== "string") return [];
		return [
			{
				id: typeof row.id === "string" ? row.id : undefined,
				code: row.code,
				raw: typeof row.raw === "number" ? row.raw : 0,
				scaled: typeof row.scaled === "number" ? row.scaled : 0,
				band: asBand(row.band),
			},
		];
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

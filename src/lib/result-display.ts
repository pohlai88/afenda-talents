/**
 * Normalize stored Result JSON for UI (legacy ValidityFlag vs ResponseContextOutcome).
 *
 * Display names and bands belong to the version document, not to Core v1: a document may
 * define any dimension codes and any number of bands. Callers that can load the document
 * pass a `DimensionLegend`; Core v1 labels remain the fallback for legacy rows.
 */
import type { InstrumentDocument } from "@/lib/instrument-document";
import { dimensionDisplayName } from "@/lib/instrument-labels";
import type {
	DimensionScore,
	ResponseContextOutcome,
	ValidityFlag,
} from "@/lib/scoring";

export type UiBand = {
	id: string;
	name: string;
	minScaled: number;
	maxScaled: number;
};

/** Everything the results UI needs from the version document to label a stored result. */
export type DimensionLegend = {
	/** Dimension code → display name. */
	names: Record<string, string>;
	/** Dimension codes in document order. */
	order: string[];
	/** Bands sorted ascending, covering 0–100. */
	bands: UiBand[];
};

export type UiDimension = {
	id?: string;
	code: string;
	/** Resolved display name — the document's, or the code itself. */
	name: string;
	raw: number;
	scaled: number;
	/** The document's band name (e.g. "Capable"), not a fixed three-band union. */
	band: string;
};

export type UiContextFlag = {
	key: string;
	label: string;
	triggered: boolean;
	reason: string;
};

export function legendFromDocument(doc: InstrumentDocument): DimensionLegend {
	const ordered = [...doc.dimensions].sort((a, b) => a.order - b.order);
	return {
		names: Object.fromEntries(ordered.map((d) => [d.code, d.name])),
		order: ordered.map((d) => d.code),
		bands: [...doc.bands]
			.sort((a, b) => a.minScaled - b.minScaled)
			.map((b) => ({
				id: b.id,
				name: b.name,
				minScaled: b.minScaled,
				maxScaled: b.maxScaled,
			})),
	};
}

/** Document name wins; Core v1 labels cover legacy rows; the bare code is the last resort. */
export function dimensionLabel(code: string, legend?: DimensionLegend): string {
	return legend?.names[code] ?? dimensionDisplayName(code);
}

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

/**
 * Scoring stores `band` as `{ id, name }`. Older rows stored a bare string. Either way the
 * stored name is authoritative — never coerce it onto a fixed set, or a document whose bands
 * are named anything else silently reads as the wrong band.
 */
function bandName(
	value: unknown,
	scaled: number,
	bands: UiBand[] | undefined,
): string {
	if (typeof value === "string" && value.length > 0) return value;
	if (value && typeof value === "object" && "name" in value) {
		const name = (value as { name: unknown }).name;
		if (typeof name === "string" && name.length > 0) return name;
	}
	const covering = bands?.find(
		(band) => scaled >= band.minScaled && scaled <= band.maxScaled,
	);
	return covering?.name ?? "";
}

export function normalizeDimensions(
	raw: unknown,
	legend?: DimensionLegend,
): UiDimension[] {
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((d) => {
		if (!d || typeof d !== "object") return [];
		const row = d as Partial<DimensionScore> & { band?: string | { name: string } };
		if (typeof row.code !== "string") return [];
		const scaled = typeof row.scaled === "number" ? row.scaled : 0;
		return [
			{
				id: typeof row.id === "string" ? row.id : undefined,
				code: row.code,
				name: dimensionLabel(row.code, legend),
				raw: typeof row.raw === "number" ? row.raw : 0,
				scaled,
				band: bandName(row.band, scaled, legend?.bands),
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

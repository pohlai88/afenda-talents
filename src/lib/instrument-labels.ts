/** Full dimension names for HR-facing profile copy (UI §8.3). */
export const COMPETENCY_CODES = ["WER", "COM", "PSL", "ADR", "INA"] as const;

export type Band = "Developing" | "Effective" | "Strong";

export const DIMENSION_NAMES: Record<string, string> = {
	WER: "Work ethic and reliability",
	COM: "Communication and collaboration",
	PSL: "Problem solving and learning agility",
	ADR: "Adaptability and resilience",
	INA: "Integrity and accountability",
	VAL: "Response checks",
};

/** Likert 1–5 labels — same strings as the candidate assessment form. */
export const LIKERT_LABELS = [
	"Strongly disagree",
	"Disagree",
	"Neither agree nor disagree",
	"Agree",
	"Strongly agree",
] as const;

export function likertLabel(value: number): string {
	if (value < 1 || value > 5) return String(value);
	return LIKERT_LABELS[value - 1] ?? String(value);
}

/** Response-context indicator titles (UI §8.4) — not “validity flags”. */
export const RESPONSE_CONTEXT_TITLES: Record<string, string> = {
	impressionManagement: "Impression management",
	inconsistentResponding: "Response consistency",
	straightLining: "Answer variation",
	rushed: "Time on task",
};

/** Band region boundaries — keep in sync with `bandFor` in lib/scoring.ts. */
export const BAND_BOUNDARIES = {
	developingMax: 45,
	effectiveMax: 70,
} as const;

// Compile-time reminder: scoring.bandFor uses the same cut-points (Developing < 45, Effective < 70).

export function dimensionDisplayName(code: string): string {
	return DIMENSION_NAMES[code] ?? code;
}

/** Deterministic, conservative band line only — no narrative interpretation (D17). */
export function bandInterpretation(band: Band): string {
	return `This dimension falls within the ${band} band.`;
}

export function orderedDimensionCodes(codes: string[]): string[] {
	const preferred = [...COMPETENCY_CODES, "VAL"] as string[];
	const seen = new Set<string>();
	const ordered: string[] = [];
	for (const code of preferred) {
		if (codes.includes(code) && !seen.has(code)) {
			ordered.push(code);
			seen.add(code);
		}
	}
	for (const code of codes) {
		if (!seen.has(code)) {
			ordered.push(code);
			seen.add(code);
		}
	}
	return ordered;
}

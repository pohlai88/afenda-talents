/**
 * Version-driven scoring (D18). Never imports Prisma.
 * Always parse the version document before calling scoreAssessment.
 */
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import {
	orderedAllItems,
	orderedAnswerableItems,
	type InstrumentDocument,
	type ResponseContextRule,
} from "@/lib/instrument-document";

export const MS_PER_ITEM_CAP = 60_000;

export type RawResponse = {
	itemId: string;
	value: number;
	msOnItem: number;
};

export type ResponseContextOutcome = {
	ruleId: string;
	type: ResponseContextRule["type"];
	label: string;
	triggered: boolean;
	reason: string;
};

export type DimensionScore = {
	id: string;
	code: string;
	raw: number;
	scaled: number;
	band: { id: string; name: string };
};

export type ScoreAssessmentResult = {
	dimensions: DimensionScore[];
	responseContext: ResponseContextOutcome[];
	totalSeconds: number;
};

/** @deprecated Use band name from version document. Kept for UI that still expects Band union. */
export type Band = "Developing" | "Effective" | "Strong";

export function itemScore(value: number, reverseScored: boolean): number {
	return reverseScored ? 6 - value : value;
}

/**
 * For n scored Likert 1–5 items:
 * scaled = round(((raw − n) / (5n − n)) × 100) = round(((raw − n) / (4n)) × 100)
 */
export function scaleDimensionRaw(raw: number, scoredItemCount: number): number {
	if (scoredItemCount <= 0) {
		throw new Error("Cannot scale a dimension with zero scored items");
	}
	const minimumPossible = scoredItemCount * 1;
	const maximumPossible = scoredItemCount * 5;
	return Math.round(
		((raw - minimumPossible) / (maximumPossible - minimumPossible)) * 100,
	);
}

export function bandForScaled(
	scaled: number,
	bands: InstrumentDocument["bands"],
): { id: string; name: string } {
	const match = bands.find((b) => scaled >= b.minScaled && scaled <= b.maxScaled);
	if (!match) {
		throw new Error(`No band covers scaled score ${scaled}`);
	}
	return { id: match.id, name: match.name };
}

/** Legacy helper for Core v1 UI that still imports bandFor(scaled). */
export function bandFor(scaled: number): Band {
	if (scaled < 45) return "Developing";
	if (scaled < 70) return "Effective";
	return "Strong";
}

/** Legacy Core-v1-only scale (n=6). Prefer scaleDimensionRaw. */
export function scaleDimension(raw: number): number {
	return scaleDimensionRaw(raw, 6);
}

export function totalSecondsFrom(responses: RawResponse[]): number {
	const ms = responses.reduce((sum, r) => sum + Math.min(r.msOnItem, MS_PER_ITEM_CAP), 0);
	return Math.round(ms / 1000);
}

function longestRun(values: number[]): number {
	let best = 0;
	let current = 0;
	let previous: number | null = null;
	for (const v of values) {
		current = v === previous ? current + 1 : 1;
		previous = v;
		if (current > best) best = current;
	}
	return best;
}

function evaluateRule(
	rule: ResponseContextRule,
	valueOf: (id: string) => number,
	orderedValues: number[],
	totalSeconds: number,
): ResponseContextOutcome {
	if (!rule.enabled) {
		return {
			ruleId: rule.id,
			type: rule.type,
			label: rule.label,
			triggered: false,
			reason: "Rule disabled.",
		};
	}

	switch (rule.type) {
		case "social_desirability": {
			const ids = rule.itemIds ?? [];
			const sum = ids.reduce((s, id) => s + valueOf(id), 0);
			const threshold = rule.threshold ?? 8;
			const triggered = sum >= threshold;
			return {
				ruleId: rule.id,
				type: rule.type,
				label: rule.label,
				triggered,
				reason: triggered
					? rule.managerExplanation
					: "Social-desirability items were answered in the expected range.",
			};
		}
		case "consistency_pairs": {
			const pairs = rule.pairs ?? [];
			const totalDiff = pairs.reduce(
				(s, [a, b]) => s + Math.abs(valueOf(a) - valueOf(b)),
				0,
			);
			const threshold = rule.threshold ?? 4;
			const triggered = totalDiff >= threshold;
			return {
				ruleId: rule.id,
				type: rule.type,
				label: rule.label,
				triggered,
				reason: triggered
					? rule.managerExplanation
					: "Paired items were answered consistently.",
			};
		}
		case "straight_line": {
			const runLength = rule.runLength ?? 12;
			const run = longestRun(orderedValues);
			const triggered = run >= runLength;
			return {
				ruleId: rule.id,
				type: rule.type,
				label: rule.label,
				triggered,
				reason: triggered
					? `The same answer was given on ${run} items in a row.`
					: "Answers varied across the questionnaire.",
			};
		}
		case "rushed_time": {
			const threshold = rule.threshold ?? 240;
			const triggered = totalSeconds < threshold;
			return {
				ruleId: rule.id,
				type: rule.type,
				label: rule.label,
				triggered,
				reason: triggered
					? rule.managerExplanation
					: "Self-reported time on task was 4 minutes or more.",
			};
		}
	}
}

export function scoreAssessment(args: {
	versionDocument: InstrumentDocument;
	responses: RawResponse[];
}): ScoreAssessmentResult {
	if (args.versionDocument.scoringMode === "none") {
		return {
			dimensions: [],
			responseContext: [],
			totalSeconds: totalSecondsFrom(args.responses),
		};
	}

	const { versionDocument: doc, responses } = args;
	const byId = new Map(responses.map((r) => [r.itemId, r]));
	const valueOf = (id: string) => byId.get(id)?.value ?? 0;

	const dimensions = [...doc.dimensions]
		.sort((a, b) => a.order - b.order)
		.map((dim) => {
			const scoredItems = doc.items.filter(
				(i) => i.type === "scale" && i.scored && i.dimensionId === dim.id,
			);
			const raw = scoredItems.reduce((sum, item) => {
				if (item.type !== "scale") return sum;
				return sum + itemScore(valueOf(item.id), item.reverseScored);
			}, 0);
			const scaled = scaleDimensionRaw(raw, scoredItems.length);
			const band = bandForScaled(scaled, doc.bands);
			return {
				id: dim.id,
				code: dim.code,
				raw,
				scaled,
				band,
			};
		});

	const answerable = orderedAnswerableItems(doc);
	const timingResponses = answerable.map((item) => {
		const r = byId.get(item.id);
		return {
			itemId: item.id,
			value: r?.value ?? 0,
			msOnItem: r?.msOnItem ?? 0,
		};
	});
	const totalSeconds = totalSecondsFrom(timingResponses);

	const orderedValues = orderedAllItems(doc)
		.filter((i) => i.type === "scale")
		.map((i) => valueOf(i.id));

	const responseContext = doc.responseContextRules.map((rule) =>
		evaluateRule(rule, valueOf, orderedValues, totalSeconds),
	);

	return { dimensions, responseContext, totalSeconds };
}

/** Legacy Core-v1 ItemDef shape for transitional callers. Prefer scoreAssessment. */
export type ItemDef = {
	id: string;
	dimension: string;
	order: number;
	reverseScored: boolean;
	isValidity: boolean;
};

/**
 * Returns the complete set of scaled values reachable for a dimension with n
 * scored Likert 1–5 items, using round(((raw-n)/(4n))*100) for raw = n..5n.
 * Used by import/publish unreachable-band checks.
 */
export function reachableScaledValues(n: number): number[] {
	if (n <= 0) return [];
	const values: number[] = [];
	for (let raw = n; raw <= 5 * n; raw++) {
		values.push(Math.round(((raw - n) / (4 * n)) * 100));
	}
	// Deduplicate while preserving order (Math.round can produce same value for adjacent raws)
	return [...new Set(values)];
}

/** Re-export — single source lives in instrument-labels (UI + export). */
export { COMPETENCY_CODES } from "@/lib/instrument-labels";
export const STRAIGHT_LINE_RUN = 12;
export const RUSHED_SECONDS = 240;

/**
 * @deprecated Prefer scoreAssessment with a version document.
 * Kept for callers still using the flat ItemDef list during cutover.
 */
export type ValidityFlag = { code: string; triggered: boolean; reason: string };
export type Scored = {
	dimensions: { code: string; raw: number; scaled: number; band: Band }[];
	flags: ValidityFlag[];
	totalSeconds: number;
};

export function score(_items: ItemDef[], responses: RawResponse[]): Scored {
	// Transitional bridge: Core v1 document is the authority (D18).
	const result = scoreAssessment({
		versionDocument: CORE_V1_DOCUMENT,
		responses,
	});
	return {
		dimensions: result.dimensions.map((d) => ({
			code: d.code,
			raw: d.raw,
			scaled: d.scaled,
			band: d.band.name as Band,
		})),
		flags: result.responseContext.map((o) => ({
			code: legacyFlagCode(o),
			triggered: o.triggered,
			reason: o.reason,
		})),
		totalSeconds: result.totalSeconds,
	};
}

function legacyFlagCode(o: ResponseContextOutcome): string {
	switch (o.type) {
		case "social_desirability":
			return "impressionManagement";
		case "consistency_pairs":
			return "inconsistentResponding";
		case "straight_line":
			return "straightLining";
		case "rushed_time":
			return "rushed";
		default: {
			const _exhaustive: never = o.type;
			return _exhaustive;
		}
	}
}

/**
 * Embedded Core behavioural profile v1 — source material is data/instrument.json,
 * assembled here so migrate deploy never reads that file (D18).
 */
import instrument from "../../data/instrument.json";
import { LIKERT_LABELS, DIMENSION_NAMES } from "@/lib/instrument-labels";
import {
	parseInstrumentDocument,
	type InstrumentDocument,
} from "@/lib/instrument-document";

const COMPETENCY_ORDER = ["WER", "COM", "PSL", "ADR", "INA"] as const;

const DESCRIPTIONS: Record<(typeof COMPETENCY_ORDER)[number], string> = {
	WER: "Follow-through, preparation, ownership, and consistency.",
	COM: "Clarity, listening, feedback, and working with others.",
	PSL: "Breaking down problems, learning, and adapting approaches.",
	ADR: "Staying effective under change, pressure, and incomplete information.",
	INA: "Honesty, confidentiality, and owning outcomes.",
};

type RawItem = (typeof instrument.items)[number];

function buildCoreV1Document(): InstrumentDocument {
	const dimensions = COMPETENCY_ORDER.map((code, order) => ({
		id: `dim-${code}`,
		code,
		name: DIMENSION_NAMES[code] ?? code,
		description: DESCRIPTIONS[code],
		order,
	}));

	const dimByCode = new Map<string, string>(
		dimensions.map((d) => [d.code, d.id]),
	);

	const items = instrument.items.map((raw: RawItem) => {
		const isValidity = raw.isValidity;
		return {
			type: "scale" as const,
			id: raw.id,
			text: raw.text,
			required: true,
			min: 1 as const,
			max: 5 as const,
			labels: [...LIKERT_LABELS],
			scored: !isValidity,
			dimensionId: isValidity ? null : (dimByCode.get(raw.dimension) ?? null),
			reverseScored: raw.reverseScored,
		};
	});

	const itemIds = items.map((i) => i.id);

	const doc: InstrumentDocument = {
		schemaVersion: 1,
		title: "Afenda Core Behavioural Profile",
		internalDescription:
			"Protected system template — five competency dimensions plus response-context checks.",
		candidateIntroduction:
			"This is a short self-assessment about how you work. There are no right or wrong answers.",
		consent: {
			purpose:
				"This is a short self-assessment about how you work. Hiring teams use it as one structured input alongside the rest of your application.",
			whatWeCollect:
				"Your name and email address, your answer to each of the statements, and how long you spend on each one.",
			whoSeesIt:
				"Only the hiring team for this role. Your answers are not shared outside this organisation.",
			retention:
				"Responses are kept for {RETENTION_DAYS} days from the date you submit them, then deleted. You may ask us to delete them sooner by replying to the invitation email.",
		},
		estimatedMinutes: 12,
		displayMode: "continuous",
		scoringMode: "dimensional",
		dimensions,
		bands: [
			{ id: "band-developing", name: "Developing", minScaled: 0, maxScaled: 44 },
			{ id: "band-effective", name: "Effective", minScaled: 45, maxScaled: 69 },
			{ id: "band-strong", name: "Strong", minScaled: 70, maxScaled: 100 },
		],
		sections: [
			{
				id: "sec-main",
				title: "Self-assessment",
				order: 0,
				itemIds,
			},
		],
		items,
		responseContextRules: [
			{
				id: "rule-social-desirability",
				type: "social_desirability",
				label: "Impression management",
				enabled: true,
				managerExplanation:
					"Both social-desirability items were answered at the top of the scale.",
				itemIds: ["VAL-1", "VAL-2"],
				threshold: 8,
			},
			{
				id: "rule-consistency",
				type: "consistency_pairs",
				label: "Response consistency",
				enabled: true,
				managerExplanation:
					"Paired items covering the same ground were answered differently.",
				pairs: [
					["WER-1", "VAL-3"],
					["INA-1", "VAL-4"],
				],
				threshold: 4,
			},
			{
				id: "rule-straight-line",
				type: "straight_line",
				label: "Answer variation",
				enabled: true,
				managerExplanation: "The same answer was given on many items in a row.",
				runLength: 12,
			},
			{
				id: "rule-rushed",
				type: "rushed_time",
				label: "Time on task",
				enabled: true,
				managerExplanation: "Self-reported time on task was under 4 minutes.",
				threshold: 240,
			},
		],
	};

	return parseInstrumentDocument(doc);
}

/** Validated once at module load — fails fast if Core v1 drifts. */
export const CORE_V1_DOCUMENT: InstrumentDocument = buildCoreV1Document();

export const CORE_V1_ASSESSMENT_KEY = "afenda-core-behavioural-profile";

/**
 * Afenda Pre-Joining Self-Assessment 2026 — Set 2 of compulsory 2026 assessments.
 * Unscored profile (scoringMode: "none"). See docs/assessment/pre-joining.md.
 */
import {
	parseInstrumentDocument,
	type InstrumentDocument,
	type InstrumentItem,
} from "@/lib/instrument-document";

export const PRE_JOINING_2026_ASSESSMENT_KEY = "afenda-pre-joining-2026";

const CAPABILITY_LABELS = [
	"No exposure",
	"Basic exposure",
	"Working knowledge",
	"Strong practical capability",
	"Advanced capability",
] as const;

const INTEREST_LABELS = [
	"Very low interest",
	"Low interest",
	"Moderate interest",
	"High interest",
	"Very high interest",
] as const;

const READINESS_LABELS = [
	"Not ready",
	"Unlikely",
	"Open to discussion",
	"Mostly ready",
	"Fully ready",
] as const;

export const PRE_JOINING_FUNCTIONS = [
	{ id: "ops", label: "Business operations" },
	{ id: "sales", label: "Sales and business development" },
	{ id: "mkt", label: "Marketing and branding" },
	{ id: "fin", label: "Finance and accounting" },
	{ id: "hr", label: "Human resources" },
	{ id: "proc", label: "Procurement and supply chain" },
	{ id: "qa", label: "Quality and compliance" },
	{ id: "it", label: "Information technology and data" },
	{ id: "cs", label: "Customer service" },
	{ id: "pm", label: "Project coordination" },
] as const;

export const PRE_JOINING_CONDITIONS = [
	{ id: "rotation", text: "Departmental rotation" },
	{ id: "location", text: "Temporary assignment to another location" },
	{ id: "travel", text: "Travel for work" },
	{ id: "hours", text: "Working outside normal office hours when required" },
	{ id: "site", text: "Operational or site-based assignment" },
	{ id: "customer", text: "Customer-facing responsibilities" },
	{ id: "present", text: "Presentations to management" },
	{ id: "multiple", text: "Handling multiple assignments at once" },
] as const;

function scale(
	id: string,
	text: string,
	labels: readonly string[],
): InstrumentItem {
	return {
		type: "scale",
		id,
		text,
		required: true,
		min: 1,
		max: 5,
		labels: [...labels],
		scored: false,
		dimensionId: null,
		reverseScored: false,
	};
}

function longText(
	id: string,
	text: string,
	required: boolean,
	helperText?: string,
): InstrumentItem {
	return {
		type: "long_text",
		id,
		text,
		required,
		helperText,
		maxLength: required ? 2000 : 1500,
	};
}

function shortText(id: string, text: string, required = true): InstrumentItem {
	return {
		type: "short_text",
		id,
		text,
		required,
		maxLength: 200,
	};
}

function info(id: string, body: string): InstrumentItem {
	return { type: "info", id, body };
}

function buildPreJoining2026Document(): InstrumentDocument {
	const functionScales: InstrumentItem[] = PRE_JOINING_FUNCTIONS.flatMap((fn) => [
		scale(
			`fn-${fn.id}-cap`,
			`${fn.label} — your current capability`,
			CAPABILITY_LABELS,
		),
		scale(
			`fn-${fn.id}-int`,
			`${fn.label} — your level of interest`,
			INTEREST_LABELS,
		),
	]);

	const conditionScales: InstrumentItem[] = PRE_JOINING_CONDITIONS.map((c) =>
		scale(`cond-${c.id}`, c.text, READINESS_LABELS),
	);

	const items: InstrumentItem[] = [
		info(
			"info-welcome",
			"This form helps us understand your background, interests, and preferences before you join. There are no right or wrong answers. Your name and email come from your invitation.",
		),
		shortText("bg-qual", "Highest qualification"),
		shortText("bg-field", "Field of study"),
		shortText("bg-exp", "Total working experience"),
		shortText("bg-lang", "Languages spoken and written"),
		shortText("bg-loc", "Preferred work location"),
		longText(
			"mot-org",
			"Why are you interested in joining this organisation?",
			true,
		),
		longText(
			"mot-months",
			"What do you want to learn or achieve in your first few months?",
			true,
		),
		longText(
			"dir-interest",
			"Which career directions interest you most? List up to three.",
			true,
			"For example: operations, finance, people management.",
		),
		longText(
			"dir-three-year",
			"Where would you like your career to progress in the next three years?",
			true,
		),
		info(
			"info-fn-scales",
			"Rate each function twice: your current capability and your interest. These ratings are not scored — they help us read your preferences.\n\nCapability: 1 = no exposure … 5 = advanced capability\nInterest: 1 = very low … 5 = very high",
		),
		...functionScales,
		longText(
			"fn-evidence",
			"If you rated capability 4 or 5 on any function, briefly describe relevant experience (optional).",
			false,
		),
		info(
			"info-cond-scales",
			"Rate how ready you are for each working condition:\n\n1 = not ready · 3 = open to discussion · 5 = fully ready",
		),
		...conditionScales,
		longText(
			"cond-notes",
			"Any limitations or arrangements that should be discussed with HR (optional).",
			false,
		),
		longText("dev-1", "Development objective 1", true),
		longText("dev-2", "Development objective 2", true),
		longText("dev-3", "Development objective 3", true),
		longText(
			"dev-training",
			"Skills or training you would like (optional).",
			false,
		),
		shortText("rec-dept", "Recommended first department or function"),
		longText("rec-why", "Reasons for your recommendation", true),
		longText("rec-contrib", "Skills you can contribute immediately", true),
	];

	const doc: InstrumentDocument = {
		schemaVersion: 1,
		title: "Afenda Pre-Joining Self-Assessment",
		internalDescription:
			"Protected system template — unscored pre-joining profile for 2026 compulsory Set 2.",
		candidateIntroduction:
			"Tell us about your background, interests, and preferences before you join. This takes about 25 minutes and complements the shorter behavioural self-assessment.",
		consent: {
			purpose:
				"This form collects your background, career interests, and placement preferences. Hiring teams use it as one structured input alongside the rest of your application.",
			whatWeCollect:
				"Your name and email address (from your invitation), your answers to each question, and how long you spend on each one.",
			whoSeesIt:
				"Only the hiring team for this role. Your answers are not shared outside this organisation.",
			retention:
				"Responses are kept for {RETENTION_DAYS} days from the date you submit them, then deleted. You may ask us to delete them sooner by replying to the invitation email.",
		},
		estimatedMinutes: 25,
		displayMode: "section",
		scoringMode: "none",
		dimensions: [],
		bands: [],
		sections: [
			{
				id: "sec-about",
				title: "What this is",
				introduction: "About five minutes to read; the rest is your answers.",
				order: 0,
				itemIds: ["info-welcome"],
			},
			{
				id: "sec-background",
				title: "Background",
				introduction: "Your education and experience so far.",
				order: 1,
				itemIds: ["bg-qual", "bg-field", "bg-exp", "bg-lang", "bg-loc"],
			},
			{
				id: "sec-motivation",
				title: "Motivation",
				introduction: "Why you are joining and what you hope to learn.",
				order: 2,
				itemIds: ["mot-org", "mot-months"],
			},
			{
				id: "sec-direction",
				title: "Career direction",
				introduction: "Where you want to grow over the next few years.",
				order: 3,
				itemIds: ["dir-interest", "dir-three-year"],
			},
			{
				id: "sec-functions",
				title: "Functions",
				introduction: "Rate capability and interest for each business area.",
				order: 4,
				itemIds: [
					"info-fn-scales",
					...PRE_JOINING_FUNCTIONS.flatMap((fn) => [`fn-${fn.id}-cap`, `fn-${fn.id}-int`]),
					"fn-evidence",
				],
			},
			{
				id: "sec-conditions",
				title: "Working conditions",
				introduction: "How ready you are for common assignment types.",
				order: 5,
				itemIds: [
					"info-cond-scales",
					...PRE_JOINING_CONDITIONS.map((c) => `cond-${c.id}`),
					"cond-notes",
				],
			},
			{
				id: "sec-development",
				title: "Development",
				introduction: "What you want to achieve in your first months.",
				order: 6,
				itemIds: ["dev-1", "dev-2", "dev-3", "dev-training"],
			},
			{
				id: "sec-recommendation",
				title: "Self-recommendation",
				introduction: "Where you think you would contribute best initially.",
				order: 7,
				itemIds: ["rec-dept", "rec-why", "rec-contrib"],
			},
		],
		items,
		responseContextRules: [],
	};

	return parseInstrumentDocument(doc);
}

/** Validated once at module load. */
export const PRE_JOINING_2026_DOCUMENT: InstrumentDocument =
	buildPreJoining2026Document();

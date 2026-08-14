/**
 * Lenient draft shape for autosave; publish uses parseInstrumentDocument (strict).
 */
import { z } from "zod";
import { LIKERT_LABELS } from "@/lib/instrument-labels";
import { RESPONSE_CONTEXT_TYPES } from "@/lib/instrument-document";
import type { InstrumentDocument } from "@/lib/instrument-document";

const draftLikertSchema = z.object({
	type: z.literal("likert"),
	id: z.string().min(1),
	text: z.string(),
	required: z.boolean(),
	min: z.literal(1),
	max: z.literal(5),
	labels: z.array(z.string()).length(5),
	scored: z.boolean(),
	dimensionId: z.string().nullable(),
	reverseScored: z.boolean(),
	// Optional: canonicalizeDocumentOrder stamps it, and the workbook round-trip
	// carries it back. Stripping it here silently reorders an imported draft.
	order: z.number().int().optional(),
});

const draftTextItemSchema = z.object({
	type: z.enum(["short_text", "long_text"]),
	id: z.string().min(1),
	text: z.string(),
	required: z.boolean(),
	helperText: z.string().optional(),
	maxLength: z.number().int().positive().optional(),
	order: z.number().int().optional(),
});

const draftInfoSchema = z.object({
	type: z.literal("info"),
	id: z.string().min(1),
	body: z.string(),
	order: z.number().int().optional(),
});

const draftItemSchema = z.discriminatedUnion("type", [
	draftLikertSchema,
	draftTextItemSchema,
	draftInfoSchema,
]);

const draftDimensionSchema = z.object({
	id: z.string().min(1),
	code: z.string(),
	name: z.string(),
	description: z.string().optional(),
	order: z.number().int(),
});

const draftBandSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	minScaled: z.number().int(),
	maxScaled: z.number().int(),
});

const draftSectionSchema = z.object({
	id: z.string().min(1),
	title: z.string(),
	introduction: z.string().optional(),
	order: z.number().int(),
	itemIds: z.array(z.string()),
});

const draftRuleSchema = z.object({
	id: z.string().min(1),
	type: z.enum(RESPONSE_CONTEXT_TYPES),
	label: z.string(),
	enabled: z.boolean(),
	managerExplanation: z.string(),
	itemIds: z.array(z.string()).optional(),
	threshold: z.number().optional(),
	pairs: z.array(z.tuple([z.string(), z.string()])).optional(),
	runLength: z.number().int().positive().optional(),
});

export const draftInstrumentDocumentSchema = z.object({
	schemaVersion: z.literal(1),
	title: z.string(),
	internalDescription: z.string().optional(),
	candidateIntroduction: z.string(),
	consent: z.object({
		purpose: z.string(),
		whatWeCollect: z.string(),
		whoSeesIt: z.string(),
		retention: z.string(),
	}),
	estimatedMinutes: z.number(),
	displayMode: z.enum(["continuous", "section"]),
	dimensions: z.array(draftDimensionSchema),
	bands: z.array(draftBandSchema),
	sections: z.array(draftSectionSchema),
	items: z.array(draftItemSchema),
	responseContextRules: z.array(draftRuleSchema),
});

export type DraftInstrumentDocument = z.infer<typeof draftInstrumentDocumentSchema>;

export function parseDraftDocument(input: unknown): DraftInstrumentDocument {
	return draftInstrumentDocumentSchema.parse(input);
}

export function blankInstrumentDocument(title = "Untitled assessment"): DraftInstrumentDocument {
	const dimId = "dim-1";
	const sectionId = "sec-1";
	const itemId = "item-1";
	return {
		schemaVersion: 1,
		title,
		internalDescription: "",
		candidateIntroduction: "",
		consent: {
			purpose: "",
			whatWeCollect: "",
			whoSeesIt: "",
			retention:
				"Responses are kept for {RETENTION_DAYS} days from the date you submit them, then deleted.",
		},
		estimatedMinutes: 10,
		displayMode: "continuous",
		dimensions: [
			{
				id: dimId,
				code: "DIM1",
				name: "Dimension 1",
				description: "",
				order: 0,
			},
		],
		bands: [
			{ id: "band-developing", name: "Developing", minScaled: 0, maxScaled: 44 },
			{ id: "band-effective", name: "Effective", minScaled: 45, maxScaled: 69 },
			{ id: "band-strong", name: "Strong", minScaled: 70, maxScaled: 100 },
		],
		sections: [
			{
				id: sectionId,
				title: "Section 1",
				order: 0,
				itemIds: [itemId],
			},
		],
		items: [
			{
				type: "likert",
				id: itemId,
				text: "",
				required: true,
				min: 1,
				max: 5,
				labels: [...LIKERT_LABELS],
				scored: true,
				dimensionId: dimId,
				reverseScored: false,
			},
		],
		responseContextRules: [],
	};
}

export type PublishIssue = {
	level: "error" | "warning";
	code: string;
	message: string;
};

/**
 * Extra publish checks beyond Zod structural integrity (D18 §12).
 * Call after parseInstrumentDocument succeeds.
 */
export function collectPublishIssues(doc: InstrumentDocument): PublishIssue[] {
	const issues: PublishIssue[] = [];

	if (!doc.title.trim()) {
		issues.push({ level: "error", code: "title", message: "Title is required." });
	}
	if (!doc.candidateIntroduction.trim()) {
		issues.push({
			level: "error",
			code: "intro",
			message: "Candidate introduction is required.",
		});
	}
	for (const [key, value] of Object.entries(doc.consent)) {
		if (!value.trim()) {
			issues.push({
				level: "error",
				code: `consent.${key}`,
				message: `Consent field "${key}" is incomplete.`,
			});
		}
	}
	if (!(doc.estimatedMinutes > 0 && doc.estimatedMinutes < 600)) {
		issues.push({
			level: "error",
			code: "estimatedMinutes",
			message: "Estimated time must be a positive number of minutes.",
		});
	}

	const answerable = doc.items.filter((i) => i.type !== "info");
	if (answerable.length === 0) {
		issues.push({
			level: "error",
			code: "no_questions",
			message: "At least one answerable item is required.",
		});
	}

	if (doc.estimatedMinutes > 45) {
		issues.push({
			level: "warning",
			code: "long_assessment",
			message: "Estimated completion time is over 45 minutes.",
		});
	}

	const requiredText = doc.items.filter(
		(i) => (i.type === "short_text" || i.type === "long_text") && i.required,
	).length;
	if (requiredText > 5) {
		issues.push({
			level: "warning",
			code: "many_open_text",
			message: "Many required open-text items may slow completion.",
		});
	}

	const reverseCount = doc.items.filter(
		(i) => i.type === "scale" && i.reverseScored,
	).length;
	const likertCount = doc.items.filter((i) => i.type === "scale").length;
	if (likertCount > 0 && reverseCount / likertCount > 0.5) {
		issues.push({
			level: "warning",
			code: "many_reverse",
			message: "More than half of Likert items are reverse-scored.",
		});
	}

	for (const dim of doc.dimensions) {
		const n = doc.items.filter(
			(i) => i.type === "scale" && i.scored && i.dimensionId === dim.id,
		).length;
		if (n > 0 && n < 3) {
			issues.push({
				level: "warning",
				code: `dim_small_${dim.id}`,
				message: `Dimension ${dim.code} has fewer than 3 scored items.`,
			});
		}
	}

	return issues;
}

export function publishBlockers(issues: PublishIssue[]): PublishIssue[] {
	return issues.filter((i) => i.level === "error");
}

/**
 * Shared draft ↔ published instrument document (D18).
 * Validate at seed/backfill, draft write, publish, and before every score.
 */
import { z } from "zod";

export const RESPONSE_CONTEXT_TYPES = [
	"social_desirability",
	"consistency_pairs",
	"straight_line",
	"rushed_time",
] as const;

export type ResponseContextType = (typeof RESPONSE_CONTEXT_TYPES)[number];

const likertItemSchema = z.object({
	type: z.literal("likert"),
	id: z.string().min(1),
	text: z.string().min(1),
	required: z.boolean(),
	min: z.literal(1),
	max: z.literal(5),
	labels: z.array(z.string()).length(5),
	scored: z.boolean(),
	dimensionId: z.string().nullable(),
	reverseScored: z.boolean(),
});

const textItemSchema = z.object({
	type: z.enum(["short_text", "long_text"]),
	id: z.string().min(1),
	text: z.string().min(1),
	required: z.boolean(),
	helperText: z.string().optional(),
	maxLength: z.number().int().positive().optional(),
});

const infoItemSchema = z.object({
	type: z.literal("info"),
	id: z.string().min(1),
	body: z.string().min(1),
});

export const instrumentItemSchema = z.discriminatedUnion("type", [
	likertItemSchema,
	textItemSchema,
	infoItemSchema,
]);

export type InstrumentItem = z.infer<typeof instrumentItemSchema>;

const responseContextRuleSchema = z.object({
	id: z.string().min(1),
	type: z.enum(RESPONSE_CONTEXT_TYPES),
	label: z.string().min(1),
	enabled: z.boolean(),
	managerExplanation: z.string().min(1),
	itemIds: z.array(z.string()).optional(),
	threshold: z.number().optional(),
	pairs: z.array(z.tuple([z.string(), z.string()])).optional(),
	runLength: z.number().int().positive().optional(),
});

export type ResponseContextRule = z.infer<typeof responseContextRuleSchema>;

const dimensionSchema = z.object({
	id: z.string().min(1),
	code: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	order: z.number().int(),
});

const bandSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	minScaled: z.number().int().min(0).max(100),
	maxScaled: z.number().int().min(0).max(100),
});

const sectionSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	introduction: z.string().optional(),
	order: z.number().int(),
	itemIds: z.array(z.string().min(1)).min(1),
});

export const instrumentDocumentSchema = z
	.object({
		schemaVersion: z.literal(1),
		title: z.string().min(1),
		internalDescription: z.string().optional(),
		candidateIntroduction: z.string().min(1),
		consent: z.object({
			purpose: z.string().min(1),
			whatWeCollect: z.string().min(1),
			whoSeesIt: z.string().min(1),
			retention: z.string().min(1),
		}),
		estimatedMinutes: z.number().positive(),
		displayMode: z.enum(["continuous", "section"]),
		dimensions: z.array(dimensionSchema).min(1),
		bands: z.array(bandSchema).min(1),
		sections: z.array(sectionSchema).min(1),
		items: z.array(instrumentItemSchema).min(1),
		responseContextRules: z.array(responseContextRuleSchema),
	})
	.superRefine((doc, ctx) => {
		const itemIds = new Set(doc.items.map((i) => i.id));
		if (itemIds.size !== doc.items.length) {
			ctx.addIssue({
				code: "custom",
				message: "Duplicate item ids",
				path: ["items"],
			});
		}

		const dimIds = new Set(doc.dimensions.map((d) => d.id));
		if (dimIds.size !== doc.dimensions.length) {
			ctx.addIssue({
				code: "custom",
				message: "Duplicate dimension ids",
				path: ["dimensions"],
			});
		}

		const seenInSections = new Set<string>();
		for (const [si, section] of doc.sections.entries()) {
			const local = new Set<string>();
			for (const id of section.itemIds) {
				if (!itemIds.has(id)) {
					ctx.addIssue({
						code: "custom",
						message: `Unknown item id ${id}`,
						path: ["sections", si, "itemIds"],
					});
				}
				if (local.has(id)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate item id ${id} within section`,
						path: ["sections", si, "itemIds"],
					});
				}
				if (seenInSections.has(id)) {
					ctx.addIssue({
						code: "custom",
						message: `Item ${id} appears in more than one section`,
						path: ["sections", si, "itemIds"],
					});
				}
				local.add(id);
				seenInSections.add(id);
			}
		}

		for (const id of itemIds) {
			if (!seenInSections.has(id)) {
				ctx.addIssue({
					code: "custom",
					message: `Item ${id} is not in any section`,
					path: ["items"],
				});
			}
		}

		for (const [ii, item] of doc.items.entries()) {
			if (item.type === "likert" && item.scored) {
				if (!item.dimensionId || !dimIds.has(item.dimensionId)) {
					ctx.addIssue({
						code: "custom",
						message: `Scored Likert ${item.id} needs a valid dimensionId`,
						path: ["items", ii, "dimensionId"],
					});
				}
			}
		}

		for (const dim of doc.dimensions) {
			const n = doc.items.filter(
				(i) => i.type === "likert" && i.scored && i.dimensionId === dim.id,
			).length;
			if (n === 0) {
				ctx.addIssue({
					code: "custom",
					message: `Dimension ${dim.code} has no scored Likert items`,
					path: ["dimensions"],
				});
			}
		}

		const sortedBands = [...doc.bands].sort((a, b) => a.minScaled - b.minScaled);
		if (sortedBands[0]?.minScaled !== 0) {
			ctx.addIssue({
				code: "custom",
				message: "Bands must start at 0",
				path: ["bands"],
			});
		}
		const last = sortedBands[sortedBands.length - 1];
		if (last && last.maxScaled !== 100) {
			ctx.addIssue({
				code: "custom",
				message: "Bands must end at 100",
				path: ["bands"],
			});
		}
		for (let i = 0; i < sortedBands.length; i++) {
			const b = sortedBands[i]!;
			if (b.minScaled > b.maxScaled) {
				ctx.addIssue({
					code: "custom",
					message: `Band ${b.id} has min > max`,
					path: ["bands"],
				});
			}
			const next = sortedBands[i + 1];
			if (next && b.maxScaled + 1 !== next.minScaled) {
				ctx.addIssue({
					code: "custom",
					message: "Bands must cover 0–100 without gaps or overlaps",
					path: ["bands"],
				});
			}
		}

		for (const [ri, rule] of doc.responseContextRules.entries()) {
			const ids = [
				...(rule.itemIds ?? []),
				...(rule.pairs?.flat() ?? []),
			];
			for (const id of ids) {
				if (!itemIds.has(id)) {
					ctx.addIssue({
						code: "custom",
						message: `Rule ${rule.id} references missing item ${id}`,
						path: ["responseContextRules", ri],
					});
				}
			}
		}
	});

export type InstrumentDocument = z.infer<typeof instrumentDocumentSchema>;

export function parseInstrumentDocument(input: unknown): InstrumentDocument {
	return instrumentDocumentSchema.parse(input);
}

export function safeParseInstrumentDocument(input: unknown) {
	return instrumentDocumentSchema.safeParse(input);
}

/** Flatten answerable items in document order (section order, then itemIds). */
export function orderedAnswerableItems(doc: InstrumentDocument) {
	const byId = new Map(doc.items.map((i) => [i.id, i]));
	const sections = [...doc.sections].sort((a, b) => a.order - b.order);
	const out: InstrumentItem[] = [];
	for (const section of sections) {
		for (const id of section.itemIds) {
			const item = byId.get(id);
			if (item && item.type !== "info") out.push(item);
		}
	}
	return out;
}

export function orderedAllItems(doc: InstrumentDocument): InstrumentItem[] {
	const byId = new Map(doc.items.map((i) => [i.id, i]));
	const sections = [...doc.sections].sort((a, b) => a.order - b.order);
	const out: InstrumentItem[] = [];
	for (const section of sections) {
		for (const id of section.itemIds) {
			const item = byId.get(id);
			if (item) out.push(item);
		}
	}
	return out;
}

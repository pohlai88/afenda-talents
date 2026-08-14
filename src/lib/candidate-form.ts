/**
 * The shape the candidate form is handed, derived from a published version document.
 *
 * Kept out of the form component so the server can build it without importing a client
 * module, and so the walk itself is testable: dropping section framing or info blocks on
 * the way to a candidate is silent in production but obvious here.
 */
import type { InstrumentDocument } from "@/lib/instrument-document";

export type AssessmentFormItem =
	| {
			id: string;
			order: number;
			text: string;
			type: "likert";
			required: boolean;
	  }
	| {
			id: string;
			order: number;
			text: string;
			type: "short_text" | "long_text";
			required: boolean;
			maxLength?: number;
			helperText?: string;
	  };

/**
 * Render order as the document defines it. Section headers and info blocks carry the
 * framing that tells a candidate how to answer, so they travel with the items they
 * introduce. Only `item` blocks are answerable.
 */
export type AssessmentFormBlock =
	| { kind: "section"; id: string; title: string; introduction?: string }
	| { kind: "info"; id: string; body: string }
	| { kind: "item"; item: AssessmentFormItem };

/**
 * Sections in document order, items in section order — the same walk as `orderedAllItems`,
 * but keeping the section boundaries the candidate needs to see. Section headers appear
 * only when the document displays by section, matching the admin preview. Numbering counts
 * answerable items alone, so it matches the number a candidate is asked to complete.
 */
export function buildCandidateBlocks(
	doc: InstrumentDocument,
): AssessmentFormBlock[] {
	const itemsById = new Map(doc.items.map((item) => [item.id, item]));
	const blocks: AssessmentFormBlock[] = [];
	let order = 0;

	for (const section of [...doc.sections].sort((a, b) => a.order - b.order)) {
		if (doc.displayMode === "section") {
			blocks.push({
				kind: "section",
				id: section.id,
				title: section.title,
				introduction: section.introduction,
			});
		}
		for (const id of section.itemIds) {
			const item = itemsById.get(id);
			if (!item) continue;
			if (item.type === "info") {
				blocks.push({ kind: "info", id: item.id, body: item.body });
				continue;
			}
			order += 1;
			blocks.push({
				kind: "item",
				item:
					item.type === "likert"
						? {
								id: item.id,
								order,
								text: item.text,
								type: "likert",
								required: item.required,
							}
						: {
								id: item.id,
								order,
								text: item.text,
								type: item.type,
								required: item.required,
								maxLength: item.maxLength,
								helperText: item.helperText,
							},
			});
		}
	}

	return blocks;
}

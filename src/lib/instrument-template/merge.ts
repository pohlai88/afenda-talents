/**
 * Import merge pipeline — previewImport.
 *
 * Formats: xlsx (§5.4), json (§5.4 ¶JSON format).
 * CSV lives in csv.ts.
 *
 * Pure module. No Prisma.
 */

import { parseWorkbook, projectVisible, type ParseWorkbookSuccess } from "@/lib/instrument-template/workbook";
import { canonicalJson, sha256Hex } from "@/lib/instrument-template/visible";
import { applyIdentity } from "@/lib/instrument-template/identity";
import { assertReferentialIntegrity } from "@/lib/instrument-template/integrity";
import { diffInstruments, type InstrumentDiff } from "@/lib/instrument-template/diff";
import { assertInstrumentInvariants, type ImportIssue } from "@/lib/instrument-invariants";
import { canonicalizeDocumentOrder } from "@/lib/instrument-order";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import { parseDraftDocument } from "@/lib/instrument-draft";

/**
 * Issues surfaced by an import preview. Invariant checks only ever emit "hard",
 * but workbook parsing also reports recoverable "soft" problems (a scientific-
 * notation id, an unreadable boolean), which a preview must show without
 * refusing the file. Every ImportIssue is a valid MergeIssue.
 */
type MergeIssue = Omit<ImportIssue, "severity"> & { severity: "hard" | "soft" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PreviewImportArgs = {
	format: "xlsx" | "json" | "csv";
	bytes: Uint8Array | Buffer;
	/** Current target draft document, or null on create */
	target: unknown | null;
	/** Assessment id, null on create */
	targetId: string | null;
	liveDraftRevision: number | null;
	livePublishedVersionNumber: number | null;
	targetKind?: "TEMPLATE" | "ORGANISATION";
};

export type PreviewResult =
	| { refuse: string }
	| {
			document: unknown;
			diff: InstrumentDiff;
			issues: MergeIssue[];
			committable: boolean;
			sourceMode?: "strict" | "draft";
	  };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeAssessmentId(id: string | null | undefined): string | null {
	if (!id) return null;
	return String(id).normalize("NFKC").trim().toLowerCase();
}

/**
 * Build importableNow from identity-resolved rows (same shape as projectVisible().importable).
 * Order canonicalization is applied per section (items) and globally (sections, dimensions).
 * H_now = sha256(canonicalJson(importableNow)).
 */
function buildImportableNow(
	parsed: ParseWorkbookSuccess,
	identityItems: Array<{ id: string; [k: string]: unknown }>,
	identitySections: Array<{ id: string; [k: string]: unknown }>,
	identityDimensions: Array<{ id: string; [k: string]: unknown }>,
	identityBands: Array<{ id: string; [k: string]: unknown }>,
): { importableNow: unknown; hNow: string } {
	// Build a partial document with the identity-resolved entities
	const partialDoc = {
		title: String(parsed.importableSheets.meta.title ?? ""),
		internalDescription: parsed.importableSheets.meta.internalDescription,
		candidateIntroduction: String(parsed.importableSheets.meta.candidateIntroduction ?? ""),
		estimatedMinutes: Number(parsed.importableSheets.meta.estimatedMinutes ?? 0),
		displayMode: String(parsed.importableSheets.meta.displayMode ?? ""),
		scoringMode: parsed.importableSheets.meta.scoringMode,
		consent: parsed.importableSheets.consent,
		sections: identitySections.map((s) => ({
			...s,
			itemIds: [] as string[], // will be rebuilt by canonicalize
		})),
		dimensions: identityDimensions,
		items: identityItems.map((item) => ({
			...item,
			// sectionId from parsed sheets
			sectionId: (parsed.importableSheets.items.find((pi) => {
				const pItem = pi as Record<string, unknown>;
				return pItem.id === item.id;
			}) as Record<string, unknown> | undefined)?.sectionId,
		})),
		bands: identityBands,
	};

	// Assign items to sections based on sectionId
	const sectionMap = new Map<string, { id: string; itemIds: string[]; order: number; [k: string]: unknown }>();
	for (const s of partialDoc.sections) {
		sectionMap.set(String(s.id), { ...s, itemIds: [], order: Number((s as Record<string, unknown>).order ?? 0) });
	}

	for (const item of partialDoc.items) {
		const sId = String((item as Record<string, unknown>).sectionId ?? "");
		if (sId && sectionMap.has(sId)) {
			sectionMap.get(sId)!.itemIds.push(item.id);
		}
	}

	const docWithSections = {
		...partialDoc,
		sections: Array.from(sectionMap.values()),
		// Sheets list dimensions in row order and may omit `order` entirely.
		// canonicalizeDocumentOrder renumbers globally, so the row index is the
		// sort key when the sheet does not supply one — same treatment sections
		// already get above.
		dimensions: partialDoc.dimensions.map((d, i) => ({
			...d,
			order: Number((d as Record<string, unknown>).order ?? i),
		})),
	};

	// canonicalizeDocumentOrder: sorts by item.order within each section, renumbers 1..n
	const canonicalized = canonicalizeDocumentOrder(docWithSections as Parameters<typeof canonicalizeDocumentOrder>[0]);

	// Build the importableNow shape (same as projectVisible().importable)
	const { importable: importableNow } = projectVisible(canonicalized);
	const hNow = sha256Hex(canonicalJson(importableNow));

	return { importableNow, hNow };
}

/**
 * Merge representable fields from parsed sheets onto a clone of sourceDocument.
 * Copies responseContextRules and other non-sheet keys from sourceDocument.
 */
function mergeFromSheets(
	sourceDocument: unknown,
	identityResult: ReturnType<typeof applyIdentity>,
	parsed: ParseWorkbookSuccess,
): unknown {
	const src = sourceDocument as Record<string, unknown>;

	// Build sections with rebuilt itemIds from item.sectionId
	const identitySections = identityResult.documentPartial.sections;
	const identityItems = identityResult.documentPartial.items;

	const sectionItemIds = new Map<string, string[]>();
	for (const s of identitySections) {
		sectionItemIds.set(s.id, []);
	}

	// Items from sheet have a sectionId field — use identity-resolved items + sheet sectionId
	for (const item of identityItems) {
		// Find matching parsed sheet item to get sectionId
		const parsedSheetItem = parsed.importableSheets.items.find((pi) => {
			const pItem = pi as Record<string, unknown>;
			return String(pItem.id ?? "") === item.id || pItem === item;
		});
		const sId = parsedSheetItem
			? String((parsedSheetItem as Record<string, unknown>).sectionId ?? "")
			: "";
		if (sId && sectionItemIds.has(sId)) {
			sectionItemIds.get(sId)!.push(item.id);
		}
	}

	const mergedSections = identitySections.map((s) => {
		const sheetSection = parsed.importableSheets.sections.find((ps) => {
			return String((ps as Record<string, unknown>).id ?? "") === s.id || ps === s;
		}) as Record<string, unknown> | undefined;
		return {
			...s,
			title: sheetSection ? String(sheetSection.title ?? s.title) : String((s as Record<string, unknown>).title ?? ""),
			introduction: sheetSection?.introduction,
			order: sheetSection ? (sheetSection.order as number) : (s as Record<string, unknown>).order as number,
			itemIds: sectionItemIds.get(s.id) ?? [],
		};
	});

	const mergedDoc = {
		...src,
		// Meta fields from sheet
		title: String(parsed.importableSheets.meta.title ?? src.title ?? ""),
		internalDescription: parsed.importableSheets.meta.internalDescription ?? src.internalDescription,
		candidateIntroduction: String(parsed.importableSheets.meta.candidateIntroduction ?? src.candidateIntroduction ?? ""),
		estimatedMinutes: Number(parsed.importableSheets.meta.estimatedMinutes ?? src.estimatedMinutes ?? 0),
		displayMode: String(parsed.importableSheets.meta.displayMode ?? src.displayMode ?? ""),
		scoringMode: parsed.importableSheets.meta.scoringMode ?? src.scoringMode,
		// Consent from sheet
		consent: parsed.importableSheets.consent,
		// Entities with identity
		sections: mergedSections,
		dimensions: identityResult.documentPartial.dimensions.map((d, i) => ({
			...d,
			order: Number((d as Record<string, unknown>).order ?? i),
		})),
		items: identityItems,
		bands: identityResult.documentPartial.bands,
		// Preserve invisible fields from source
		responseContextRules: src.responseContextRules,
	};

	// canonicalizeDocumentOrder
	return canonicalizeDocumentOrder(mergedDoc as Parameters<typeof canonicalizeDocumentOrder>[0]);
}

/**
 * Compare ContextRules sheet rows to expected contextRules from sourceDocument.
 */
function checkContextRulesDrift(
	parsed: ParseWorkbookSuccess,
	sourceDocument: unknown,
): MergeIssue[] {
	if (parsed.contextRulesSheet === "absent") return [];

	const src = sourceDocument as Record<string, unknown>;
	const expectedRules = Array.isArray(src.responseContextRules)
		? (src.responseContextRules as Record<string, unknown>[])
		: [];

	// Normalize sheet rows for compare
	const sheetRows = parsed.contextRulesSheet.rows as Record<string, unknown>[];

	// Simple compare: if canonical JSON of sheet rows vs expected rules differs, emit hard issues
	// per changed rule id
	const issues: MergeIssue[] = [];

	const sheetById = new Map<string, Record<string, unknown>>();
	for (const row of sheetRows) {
		const id = String(row.id ?? "");
		if (id) sheetById.set(id, row);
	}

	const expectedById = new Map<string, Record<string, unknown>>();
	for (const rule of expectedRules) {
		const id = String(rule.id ?? "");
		if (id) expectedById.set(id, rule);
	}

	// Check for any drift
	const allIds = new Set([...sheetById.keys(), ...expectedById.keys()]);
	for (const id of allIds) {
		const sheetRow = sheetById.get(id);
		const expectedRule = expectedById.get(id);

		if (!sheetRow || !expectedRule) {
			issues.push({
				severity: "hard",
				code: "context_rules_drift",
				message: `Response-context rule "${id}" looks different from the export. Excel cannot edit rules — leave this sheet alone or use JSON.`,
			});
		} else {
			// Normalize both for comparison (canonicalCell-style comparison of canonical JSON)
			// The exporter writes `?? ""` for every scalar and "" for a non-array
			// itemIds/pairs, and an empty cell reads back as undefined or null.
			// Compare both sides through the same coercion so an absent threshold
			// does not read as drift against an empty cell.
			const cell = (v: unknown): string =>
				v === undefined || v === null ? "" : String(v);

			const sheetNorm = canonicalJson({
				id: cell(sheetRow.id),
				type: cell(sheetRow.type),
				label: cell(sheetRow.label),
				enabled: cell(sheetRow.enabled),
				managerExplanation: cell(sheetRow.managerExplanation),
				itemIds: cell(sheetRow.itemIds),
				threshold: cell(sheetRow.threshold),
				pairs: cell(sheetRow.pairs),
				runLength: cell(sheetRow.runLength),
			});

			// Mirror exportWorkbook's ContextRules row exactly.
			const expNorm = canonicalJson({
				id: cell(expectedRule.id),
				type: cell(expectedRule.type),
				label: cell(expectedRule.label),
				enabled: cell(expectedRule.enabled),
				managerExplanation: cell(expectedRule.managerExplanation),
				itemIds: Array.isArray(expectedRule.itemIds)
					? (expectedRule.itemIds as string[]).join(",")
					: "",
				threshold: cell(expectedRule.threshold),
				pairs: Array.isArray(expectedRule.pairs)
					? JSON.stringify(expectedRule.pairs)
					: "",
				runLength: cell(expectedRule.runLength),
			});

			if (sheetNorm !== expNorm) {
				issues.push({
					severity: "hard",
					code: "context_rules_drift",
					message: `Response-context rule "${id}" looks different from the export. Excel cannot edit rules — leave this sheet alone or use JSON.`,
				});
			}
		}
	}

	return issues;
}

// ---------------------------------------------------------------------------
// xlsx import path
// ---------------------------------------------------------------------------

async function previewImportXlsx(
	args: PreviewImportArgs,
	bytes: Buffer,
): Promise<PreviewResult> {
	// Step 1: parseWorkbook
	const parseResult = await parseWorkbook(bytes);

	if ("refuse" in parseResult) {
		return { refuse: parseResult.refuse };
	}

	const parsed = parseResult;
	const { sourceDocument, sourceHash, baseAssessmentId, baseDraftRevision, basePublishedVersionNumber } = parsed;

	const allIssues: MergeIssue[] = [...parsed.issues];

	// Step 2: Short-circuit if parse-level hard issues (do not feed __error_ ids into integrity)
	const parseHardIssues = allIssues.filter((i) => i.severity === "hard");
	if (parseHardIssues.length > 0) {
		return {
			document: undefined as unknown,
			diff: {
				summary: {
					breaking: false,
					orderOnly: false,
					unreachableBands: false,
					itemCountChanged: false,
					staleBase: false,
					invisibleFieldRevert: false,
					contextRulesSheetDrift: false,
				},
				entries: [],
			},
			issues: allIssues,
			committable: false,
			sourceMode: parsed.sourceMode,
		};
	}

	// Step 8 (destination check — before identity)
	const normalizedBase = normalizeAssessmentId(baseAssessmentId);
	const normalizedTarget = normalizeAssessmentId(args.targetId);

	if (args.targetId !== null) {
		// Update path: A4 must match targetId
		if (normalizedBase !== normalizedTarget) {
			return {
				refuse: "This workbook was exported from another assessment.",
			};
		}
	}
	// Create path: A4 may be empty (no check needed if targetId is null)

	// Step 3: applyIdentity
	const phase = args.targetId === null ? "create" : "update";
	const sourceDoc = phase === "update" ? (sourceDocument as Record<string, unknown>) : null;

	const identityResult = applyIdentity(
		{
			items: parsed.importableSheets.items as Array<{ id: unknown; [k: string]: unknown }>,
			sections: parsed.importableSheets.sections as Array<{ id: unknown; [k: string]: unknown }>,
			dimensions: parsed.importableSheets.dimensions as Array<{ id: unknown; [k: string]: unknown }>,
			bands: parsed.importableSheets.bands as Array<{ id: unknown; [k: string]: unknown }>,
		},
		sourceDoc,
		phase,
	);

	allIssues.push(...identityResult.issues);

	// Short-circuit if identity hard issues
	if (identityResult.issues.some((i) => i.severity === "hard")) {
		return {
			document: undefined as unknown,
			diff: {
				summary: {
					breaking: false,
					orderOnly: false,
					unreachableBands: false,
					itemCountChanged: false,
					staleBase: false,
					invisibleFieldRevert: false,
					contextRulesSheetDrift: false,
				},
				entries: [],
			},
			issues: allIssues,
			committable: false,
			sourceMode: parsed.sourceMode,
		};
	}

	// Step 4 + 5: Build importableNow and H_now
	const { hNow } = buildImportableNow(
		parsed,
		identityResult.documentPartial.items,
		identityResult.documentPartial.sections,
		identityResult.documentPartial.dimensions,
		identityResult.documentPartial.bands,
	);

	// Step 6: ContextRules guard
	const ctxIssues = checkContextRulesDrift(parsed, sourceDocument);
	allIssues.push(...ctxIssues);
	const contextRulesSheetDrift = ctxIssues.length > 0;

	// Step 7 or 8: Build merged document
	let merged: unknown;
	if (hNow === sourceHash) {
		// Fast path — no visible edits
		merged = sourceDocument;
	} else {
		// Merge representable fields from sheets
		merged = mergeFromSheets(sourceDocument, identityResult, parsed);
	}

	// Canonicalize merged
	try {
		merged = canonicalizeDocumentOrder(merged as Parameters<typeof canonicalizeDocumentOrder>[0]);
	} catch {
		// non-fatal
	}

	// Step 9 (stale base)
	let staleBase = false;
	if (args.targetId !== null) {
		const baseRev = baseDraftRevision;
		const basePub = basePublishedVersionNumber;
		const liveRev = args.liveDraftRevision;
		const livePub = args.livePublishedVersionNumber;

		if (baseRev !== liveRev || basePub !== livePub) {
			staleBase = true;
			allIssues.push({
				severity: "hard",
				code: "stale_base",
				message:
					"This workbook was exported from an older version of the assessment. Download the latest version and re-apply your changes.",
			});
		}
	}

	// Step 11: Referential integrity + shared invariants
	const integrityIssues = assertReferentialIntegrity(merged);
	allIssues.push(...integrityIssues);

	const invariantMode = parsed.sourceMode === "draft" ? "draft" : "publish";
	const invariantIssues = assertInstrumentInvariants(merged, invariantMode);
	allIssues.push(...invariantIssues);

	// Step 12: Diff
	const diff = diffInstruments(merged, args.target);

	// Patch contextRulesSheetDrift and staleBase into diff.summary
	diff.summary.contextRulesSheetDrift = contextRulesSheetDrift;
	diff.summary.staleBase = staleBase;

	// Step 13: committable
	const hasHard = allIssues.some((i) => i.severity === "hard");
	const committable = !hasHard && !staleBase;

	return {
		document: merged,
		diff,
		issues: allIssues,
		committable,
		sourceMode: parsed.sourceMode,
	};
}

// ---------------------------------------------------------------------------
// JSON import path
// ---------------------------------------------------------------------------

function previewImportJson(args: PreviewImportArgs, bytes: Buffer): PreviewResult {
	let rawStr: string;
	try {
		rawStr = bytes.toString("utf8").replace(/^\uFEFF/, ""); // strip BOM
	} catch {
		return { refuse: "Cannot decode JSON as UTF-8." };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawStr);
	} catch {
		return { refuse: "Cannot parse JSON file." };
	}

	// Try strict first, then draft
	let document: unknown;
	let sourceMode: "strict" | "draft" = "strict";
	try {
		document = parseInstrumentDocument(parsed);
	} catch {
		try {
			document = parseDraftDocument(parsed);
			sourceMode = "draft";
		} catch (e) {
			return { refuse: `JSON document failed validation: ${e instanceof Error ? e.message : String(e)}` };
		}
	}

	// Reserved assessment key check: no `afenda-` assessment key inside document.
	// Read the raw JSON, not the Zod output — assessmentKey is not part of the
	// document schema, so parsing strips it and the check would never fire.
	const docRec = (typeof parsed === "object" && parsed !== null
		? parsed
		: {}) as Record<string, unknown>;
	const reservedFields = ["assessmentKey", "id"] as const;
	for (const field of reservedFields) {
		const val = docRec[field];
		if (typeof val === "string" && val.normalize("NFKC").trim().toLowerCase().startsWith("afenda-")) {
			return { refuse: `Document field "${field}" uses reserved prefix "afenda-". Remove it before importing.` };
		}
	}

	// Canonicalize
	let merged: unknown;
	try {
		merged = canonicalizeDocumentOrder(document as Parameters<typeof canonicalizeDocumentOrder>[0]);
	} catch {
		merged = document;
	}

	const allIssues: MergeIssue[] = [];

	// No stale-base check on the JSON path: unlike the xlsx `_Source` sheet, a
	// JSON document carries no base draft revision to compare against.
	const staleBase = false;

	// Referential integrity + invariants
	const integrityIssues = assertReferentialIntegrity(merged);
	allIssues.push(...integrityIssues);

	const invariantMode = sourceMode === "draft" ? "draft" : "publish";
	const invariantIssues = assertInstrumentInvariants(merged, invariantMode);
	allIssues.push(...invariantIssues);

	const diff = diffInstruments(merged, args.target);
	diff.summary.staleBase = staleBase;

	const hasHard = allIssues.some((i) => i.severity === "hard");
	const committable = !hasHard && !staleBase;

	return {
		document: merged,
		diff,
		issues: allIssues,
		committable,
		sourceMode,
	};
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function previewImport(args: PreviewImportArgs): Promise<PreviewResult> {
	const bytes = Buffer.isBuffer(args.bytes)
		? args.bytes
		: Buffer.from(args.bytes);

	if (args.format === "xlsx") {
		return previewImportXlsx(args, bytes);
	}
	if (args.format === "json") {
		return previewImportJson(args, bytes);
	}
	if (args.format === "csv") {
		return { refuse: "CSV imports must use the CSV-specific pipeline (see csv.ts)." };
	}

	return { refuse: `Unknown format: ${String((args as Record<string, unknown>).format)}` };
}

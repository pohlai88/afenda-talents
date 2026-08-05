/**
 * projectVisible — single serializer for the importable projection.
 * canonicalJson — deterministic JSON with sorted object keys (recursive).
 *
 * Pure module. No Prisma.
 */

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// canonicalJson
// ---------------------------------------------------------------------------

/**
 * Recursively sorts object keys so the output string is deterministic.
 * Arrays preserve element order.
 */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(sortedReplacer(value));
}

function sortedReplacer(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortedReplacer);
	}
	if (value !== null && typeof value === "object") {
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			sorted[key] = sortedReplacer((value as Record<string, unknown>)[key]);
		}
		return sorted;
	}
	return value;
}

// ---------------------------------------------------------------------------
// sha256
// ---------------------------------------------------------------------------

export function sha256Hex(input: string | Buffer): string {
	return createHash("sha256").update(input).digest("hex");
}

// ---------------------------------------------------------------------------
// projectVisible types
// ---------------------------------------------------------------------------

export type ImportableMeta = {
	title: string;
	internalDescription: string | undefined;
	candidateIntroduction: string;
	estimatedMinutes: number;
	displayMode: string;
	scoringMode?: string;
};

export type ImportableConsent = {
	purpose: string;
	whatWeCollect: string;
	whoSeesIt: string;
	retention: string;
};

export type ImportableSection = {
	id: string;
	title: string;
	introduction: string | undefined;
	order: number;
};

export type ImportableDimension = {
	id: string;
	code: string;
	name: string;
	description: string | undefined;
	order: number;
};

export type ImportableItem = {
	type: string;
	id: string;
	order?: number;
	[key: string]: unknown;
};

export type ImportableBand = {
	id: string;
	name: string;
	minScaled: number;
	maxScaled: number;
};

export type ContextRule = {
	id: string;
	[key: string]: unknown;
};

export type VisibleImportable = {
	meta: ImportableMeta;
	consent: ImportableConsent;
	sections: ImportableSection[];
	dimensions: ImportableDimension[];
	items: ImportableItem[];
	bands: ImportableBand[];
};

export type VisibleProjection = {
	importable: VisibleImportable;
	contextRules: ContextRule[];
};

// ---------------------------------------------------------------------------
// projectVisible
// ---------------------------------------------------------------------------

type AnyDoc = {
	title?: unknown;
	internalDescription?: unknown;
	candidateIntroduction?: unknown;
	estimatedMinutes?: unknown;
	displayMode?: unknown;
	scoringMode?: unknown;
	consent?: unknown;
	sections?: unknown;
	dimensions?: unknown;
	items?: unknown;
	bands?: unknown;
	responseContextRules?: unknown;
	[key: string]: unknown;
};

function str(v: unknown): string {
	return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
	return typeof v === "number" ? v : 0;
}

function arr(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}

function obj(v: unknown): Record<string, unknown> {
	if (typeof v === "object" && v !== null && !Array.isArray(v)) {
		return v as Record<string, unknown>;
	}
	return {};
}

/**
 * Projects a document to its importable visible shape.
 * Excludes display-only base fields (baseAssessmentId, baseDraftRevision, basePublishedVersionNumber).
 * Excludes responseContextRules from importable (they go in contextRules).
 */
export function projectVisible(document: unknown): VisibleProjection {
	const doc = document as AnyDoc;

	const meta: ImportableMeta = {
		title: str(doc.title),
		internalDescription: typeof doc.internalDescription === "string" ? doc.internalDescription : undefined,
		candidateIntroduction: str(doc.candidateIntroduction),
		estimatedMinutes: num(doc.estimatedMinutes),
		displayMode: str(doc.displayMode),
		scoringMode: typeof doc.scoringMode === "string" ? doc.scoringMode : undefined,
	};

	const consentRaw = obj(doc.consent);
	const consent: ImportableConsent = {
		purpose: str(consentRaw.purpose),
		whatWeCollect: str(consentRaw.whatWeCollect),
		whoSeesIt: str(consentRaw.whoSeesIt),
		retention: str(consentRaw.retention),
	};

	const sections: ImportableSection[] = arr(doc.sections).map((s) => {
		const r = obj(s);
		return {
			id: str(r.id),
			title: str(r.title),
			introduction: typeof r.introduction === "string" ? r.introduction : undefined,
			order: num(r.order),
		};
	});

	const dimensions: ImportableDimension[] = arr(doc.dimensions).map((d) => {
		const r = obj(d);
		return {
			id: str(r.id),
			code: str(r.code),
			name: str(r.name),
			description: typeof r.description === "string" ? r.description : undefined,
			order: num(r.order),
		};
	});

	// Items: include all importable fields, exclude sectionId column (rebuilt by import)
	const items: ImportableItem[] = arr(doc.items).map((item) => {
		const r = obj(item);
		// Keep all fields except those that are internal/computed
		const out: ImportableItem = { type: str(r.type), id: str(r.id) };
		for (const key of Object.keys(r)) {
			if (key === "type" || key === "id") continue;
			out[key] = r[key];
		}
		return out;
	});

	const bands: ImportableBand[] = arr(doc.bands).map((b) => {
		const r = obj(b);
		return {
			id: str(r.id),
			name: str(r.name),
			minScaled: num(r.minScaled),
			maxScaled: num(r.maxScaled),
		};
	});

	const contextRules: ContextRule[] = arr(doc.responseContextRules).map((rule) => {
		const r = obj(rule);
		return { id: str(r.id), ...r } as ContextRule;
	});

	return {
		importable: { meta, consent, sections, dimensions, items, bands },
		contextRules,
	};
}

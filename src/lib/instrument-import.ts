/**
 * Shared contract for importing an instrument document into an assessment draft.
 *
 * Two-step, matching the corporate importer: preview returns a diff and issues
 * without touching the database; commit re-runs the same import server-side and
 * refuses unless the result still hashes to what the admin was shown. The client
 * never supplies the document itself — only the bytes it uploaded — so a doctored
 * payload cannot become a draft.
 *
 * Pure module: no Prisma, no next/headers.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { previewImport } from "@/lib/instrument-template/merge";
import { previewImportCsv } from "@/lib/instrument-template/csv";
import type { InstrumentDiff } from "@/lib/instrument-template/diff";

/** Matches the workbook parser's own ceiling, applied to every format. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/** Base64 inflates by 4/3; reject oversized payloads before decoding them. */
const MAX_BASE64_CHARS = Math.ceil(MAX_IMPORT_BYTES / 3) * 4 + 4;

export const IMPORT_FORMATS = ["xlsx", "json", "csv"] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

export const importPreviewSchema = z.object({
	format: z.enum(IMPORT_FORMATS),
	/** Base64 of the uploaded file. */
	content: z.string().min(1).max(MAX_BASE64_CHARS),
	/** Existing assessment to update, or null to create a new one. */
	targetId: z.string().min(1).nullable(),
});

export const importCommitSchema = importPreviewSchema.extend({
	/** sha256 of the document the admin approved in the preview. */
	previewHash: z.string().regex(/^[0-9a-f]{64}$/),
});

export type ImportPreviewInput = z.infer<typeof importPreviewSchema>;

export type ImportIssueOut = {
	severity: "hard" | "soft";
	code: string;
	message: string;
	path?: string;
	sheetRef?: string;
};

export type ImportPreviewOutcome =
	| { refuse: string }
	| {
			document: unknown;
			documentHash: string;
			diff: InstrumentDiff;
			issues: ImportIssueOut[];
			committable: boolean;
			sourceMode?: "strict" | "draft";
	  };

/** Stable identity for a previewed document, so commit can prove it is the same one. */
export function documentHash(document: unknown): string {
	return createHash("sha256").update(JSON.stringify(document) ?? "").digest("hex");
}

export function decodeImportContent(content: string): Buffer | { refuse: string } {
	let bytes: Buffer;
	try {
		bytes = Buffer.from(content, "base64");
	} catch {
		return { refuse: "Upload could not be decoded." };
	}
	if (bytes.length === 0) return { refuse: "Upload is empty." };
	if (bytes.length > MAX_IMPORT_BYTES) {
		return { refuse: `Upload exceeds the ${MAX_IMPORT_BYTES / 1024 / 1024} MiB limit.` };
	}
	return bytes;
}

/**
 * Route to the format's pipeline and normalise the two result shapes into one.
 * `target` is the live draft (or latest published document) of the assessment
 * being updated, and is null when creating.
 */
export async function runImportPreview(args: {
	input: ImportPreviewInput;
	target: unknown | null;
	liveDraftRevision: number | null;
	livePublishedVersionNumber: number | null;
}): Promise<ImportPreviewOutcome> {
	const decoded = decodeImportContent(args.input.content);
	if (!Buffer.isBuffer(decoded)) return decoded;

	const { format, targetId } = args.input;

	const result =
		format === "csv"
			? previewImportCsv({ bytes: decoded, target: args.target, targetId })
			: await previewImport({
					format,
					bytes: decoded,
					target: args.target,
					targetId,
					liveDraftRevision: args.liveDraftRevision,
					livePublishedVersionNumber: args.livePublishedVersionNumber,
				});

	if ("refuse" in result) return { refuse: result.refuse };

	return {
		document: result.document,
		documentHash: documentHash(result.document),
		diff: result.diff,
		issues: result.issues as ImportIssueOut[],
		committable: result.committable,
		...("sourceMode" in result && result.sourceMode
			? { sourceMode: result.sourceMode }
			: {}),
	};
}

/** Counts only — audit rows carry no document text (invariant 6). */
export function issueCounts(issues: ImportIssueOut[]): {
	hard: number;
	soft: number;
} {
	return {
		hard: issues.filter((i) => i.severity === "hard").length,
		soft: issues.filter((i) => i.severity !== "hard").length,
	};
}

export class ImportTargetError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "ImportTargetError";
	}
}

/**
 * SYSTEM assessments are seed-owned: they may be downloaded as examples but never
 * created, updated, or replaced by import (D24 §3, §8.1). Checked at preview as
 * well as commit — a preview that succeeds where commit refuses is worse than
 * refusing early.
 */
export function assertImportableTarget(assessment: {
	isSystem: boolean;
	kind: string;
	status: string;
}): void {
	if (assessment.isSystem || assessment.kind === "SYSTEM") {
		throw new ImportTargetError(
			"This is a seed-owned instrument and cannot be changed by import. Duplicate it first, then import into the copy.",
			409,
		);
	}
	if (assessment.status === "ARCHIVED") {
		throw new ImportTargetError("Archived assessments cannot be imported into", 409);
	}
}

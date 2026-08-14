import { describe, expect, it } from "vitest";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import { parseDraftDocument } from "@/lib/instrument-draft";
import {
	MAX_IMPORT_BYTES,
	decodeImportContent,
	documentHash,
	importCommitSchema,
	importPreviewSchema,
	issueCounts,
	runImportPreview,
} from "@/lib/instrument-import";

const publishedDocument = parseInstrumentDocument(CORE_V1_DOCUMENT);

function base64Of(value: unknown): string {
	return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

describe("published document reopens as a draft", () => {
	// Regression: publishing normalises items to `type: "scale"`, while the builder's
	// draft schema speaks "likert". Without the mapping, duplicating an assessment
	// and starting a new draft both throw for anything published after the rename.
	it("parses a published document that uses type: scale", () => {
		expect(publishedDocument.items.some((i) => i.type === "scale")).toBe(true);
		const draft = parseDraftDocument(publishedDocument);
		expect(draft.items.length).toBe(publishedDocument.items.length);
		expect(draft.items.some((i) => i.type === "likert")).toBe(true);
	});

	it("still parses a legacy document that uses type: likert", () => {
		const draft = parseDraftDocument(CORE_V1_DOCUMENT);
		expect(draft.items.length).toBe(publishedDocument.items.length);
	});
});

describe("documentHash", () => {
	it("is stable for the same document", () => {
		expect(documentHash(publishedDocument)).toBe(documentHash(publishedDocument));
	});

	it("differs when the document differs", () => {
		const altered = { ...publishedDocument, title: "Something else" };
		expect(documentHash(altered)).not.toBe(documentHash(publishedDocument));
	});

	it("is a 64-character hex digest, so it satisfies the commit schema", () => {
		expect(documentHash(publishedDocument)).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("decodeImportContent", () => {
	it("decodes valid base64", () => {
		const decoded = decodeImportContent(Buffer.from("hello").toString("base64"));
		expect(Buffer.isBuffer(decoded)).toBe(true);
		expect((decoded as Buffer).toString("utf8")).toBe("hello");
	});

	it("refuses an empty upload", () => {
		expect(decodeImportContent(Buffer.from("").toString("base64"))).toEqual({
			refuse: "Upload is empty.",
		});
	});

	it("refuses an upload past the size ceiling", () => {
		const oversized = Buffer.alloc(MAX_IMPORT_BYTES + 1, 0x61).toString("base64");
		const result = decodeImportContent(oversized);
		expect(result).toHaveProperty("refuse");
		expect((result as { refuse: string }).refuse).toMatch(/exceeds/i);
	});
});

describe("import payload schemas", () => {
	it("accepts a create payload", () => {
		const parsed = importPreviewSchema.safeParse({
			format: "json",
			content: base64Of(CORE_V1_DOCUMENT),
			targetId: null,
		});
		expect(parsed.success).toBe(true);
	});

	it("rejects an unknown format", () => {
		const parsed = importPreviewSchema.safeParse({
			format: "pdf",
			content: "aGk=",
			targetId: null,
		});
		expect(parsed.success).toBe(false);
	});

	it("rejects a commit without a well-formed preview hash", () => {
		const parsed = importCommitSchema.safeParse({
			format: "json",
			content: "aGk=",
			targetId: null,
			previewHash: "not-a-hash",
		});
		expect(parsed.success).toBe(false);
	});

	it("rejects base64 past the ceiling before it is decoded", () => {
		const parsed = importPreviewSchema.safeParse({
			format: "json",
			content: "a".repeat(MAX_IMPORT_BYTES * 2),
			targetId: null,
		});
		expect(parsed.success).toBe(false);
	});
});

describe("runImportPreview", () => {
	it("previews a JSON create without touching a target", async () => {
		const outcome = await runImportPreview({
			input: { format: "json", content: base64Of(CORE_V1_DOCUMENT), targetId: null },
			target: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});
		expect(outcome).not.toHaveProperty("refuse");
		if ("refuse" in outcome) return;
		expect(outcome.committable).toBe(true);
		expect(outcome.documentHash).toMatch(/^[0-9a-f]{64}$/);
		expect(outcome.issues.filter((i) => i.severity === "hard")).toEqual([]);
	});

	it("returns a hash that matches the document it previewed", async () => {
		const outcome = await runImportPreview({
			input: { format: "json", content: base64Of(CORE_V1_DOCUMENT), targetId: null },
			target: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});
		if ("refuse" in outcome) throw new Error("expected a preview");
		expect(outcome.documentHash).toBe(documentHash(outcome.document));
	});

	it("is deterministic, so a commit re-run matches its preview", async () => {
		const input = {
			format: "json" as const,
			content: base64Of(CORE_V1_DOCUMENT),
			targetId: null,
		};
		const args = {
			input,
			target: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		};
		const first = await runImportPreview(args);
		const second = await runImportPreview(args);
		if ("refuse" in first || "refuse" in second) throw new Error("expected previews");
		expect(second.documentHash).toBe(first.documentHash);
	});

	it("refuses unparseable JSON", async () => {
		const outcome = await runImportPreview({
			input: {
				format: "json",
				content: Buffer.from("{not json", "utf8").toString("base64"),
				targetId: null,
			},
			target: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});
		expect(outcome).toHaveProperty("refuse");
	});

	it("refuses a CSV create, which has no target to upsert into", async () => {
		const outcome = await runImportPreview({
			input: {
				format: "csv",
				content: Buffer.from("id,text\nitem-1,Hello", "utf8").toString("base64"),
				targetId: null,
			},
			target: null,
			liveDraftRevision: null,
			livePublishedVersionNumber: null,
		});
		expect(outcome).toHaveProperty("refuse");
		expect((outcome as { refuse: string }).refuse).toMatch(/existing assessment/i);
	});
});

describe("issueCounts", () => {
	it("separates hard from soft", () => {
		expect(
			issueCounts([
				{ severity: "hard", code: "a", message: "a" },
				{ severity: "soft", code: "b", message: "b" },
				{ severity: "soft", code: "c", message: "c" },
			]),
		).toEqual({ hard: 1, soft: 2 });
	});
});

describe("import commit schema — target kind", () => {
	it("defaults to ORGANISATION when omitted", () => {
		const parsed = importCommitSchema.safeParse({
			format: "json",
			content: "aGk=",
			targetId: null,
			previewHash: "a".repeat(64),
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.targetKind).toBe("ORGANISATION");
	});

	it("accepts TEMPLATE", () => {
		const parsed = importCommitSchema.safeParse({
			format: "json",
			content: "aGk=",
			targetId: null,
			previewHash: "a".repeat(64),
			targetKind: "TEMPLATE",
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.targetKind).toBe("TEMPLATE");
	});

	it("refuses SYSTEM, which is not reachable through the API", () => {
		const parsed = importCommitSchema.safeParse({
			format: "json",
			content: "aGk=",
			targetId: null,
			previewHash: "a".repeat(64),
			targetKind: "SYSTEM",
		});
		expect(parsed.success).toBe(false);
	});
});

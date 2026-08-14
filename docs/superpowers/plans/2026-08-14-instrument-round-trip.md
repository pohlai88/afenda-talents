# Instrument Download/Upload Round Trip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin download an instrument template, author it offline in Excel, and upload it back — and stop uploads from overwriting seed-owned SYSTEM assessments.

**Architecture:** Two new read endpoints stream the existing, already-tested `exportWorkbook` / `exportCsv` library functions, which currently have zero callers. A template download stamps no base identity so it reads as "create"; `[id]/export` stamps the real base so it reads as "update". Three corrections land on the import handlers shipped in `fa90e0d`.

**Tech Stack:** Next.js 16 App Router (`proxy.ts`, not middleware), React 19, Prisma 7 with driver adapters, Zod 4, vitest, shadcn on Base UI (`render` prop, no `asChild`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-14-instrument-round-trip-design.md`. Parent: `2026-08-05-instrument-template-import-design.md` (D24). Where this plan is silent, D24 governs.
- Every platform-mutating handler calls `requireAdmin()`; read surfaces call `requireHiringUser()`.
- Zod-validate every API body and every query string.
- `AuditEvent` stores no name, no email, and **no filename** (D24 §13). `audit()` runs `assertNoPii(meta)`.
- `lib/scoring.ts` stays pure — no Prisma imports.
- No pass/fail, no ranking, no single overall score.
- No Prisma schema migration in this plan. `Assessment.key` is already `String? @unique`.
- `pnpm lint` runs `eslint --max-warnings=0` — a warning fails the build.
- Run `bash .claude/skills/afenda-talents-build/check-invariants.sh` **bare** before each commit. Never pipe it into `&&` or `tail`; the pipe reports the wrong exit code and a violation sails through.
- A task is done when its commands have been run and their output pasted. "Should pass" is not evidence.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/instrument-kind.ts` | **Create.** Key normalisation, reserved-prefix check, `kindFlags`, key allocator. Pure. |
| `src/lib/instrument-download.ts` | **Create.** Template registry, filename slug, content-type + extension per format. Pure. |
| `src/app/api/admin/assessments/template/route.ts` | **Create.** `GET` blank/example download. |
| `src/app/api/admin/assessments/[id]/export/route.ts` | **Create.** `GET` download of one assessment. |
| `src/lib/instrument-import.ts` | **Modify.** Add `targetKind` to the commit schema. |
| `src/app/api/admin/assessments/import/preview/route.ts` | **Modify.** SYSTEM guard. |
| `src/app/api/admin/assessments/import/commit/route.ts` | **Modify.** SYSTEM guard, kind, key allocation. |
| `src/app/api/admin/export/route.ts` | **Modify.** Drop its private `filePart`, import the shared one. |
| `src/components/assessment-builder/download-template-button.tsx` | **Create.** Header dialog. |
| `src/components/assessment-builder/download-assessment-button.tsx` | **Create.** Row action dialog. |
| `src/components/assessment-builder/import-assessment-button.tsx` | **Modify.** Kind toggle. |
| `src/app/admin/(shell)/assessments/page.tsx` | **Modify.** Wire the three buttons. |

---

### Task 1: Prove export → import-as-new actually works

Spec §10 names this the open risk. `merge.ts` compares `_Source`'s `baseAssessmentId` against the supplied target, and the null-target path has never been exercised. Everything else in this plan assumes it works. Find out first — if it is broken, the fix is in `merge.ts`, and building UI on top of a broken round trip wastes the rest of the plan.

**Files:**
- Test: `tests/unit/instrument-round-trip.test.ts` (create)
- Possibly modify: `src/lib/instrument-template/merge.ts`

**Interfaces:**
- Consumes: `exportWorkbook(document: unknown, meta: ExportMeta): Promise<Buffer>` where `ExportMeta = { sourceMode: "strict" | "draft"; baseAssessmentId?: string | null; baseDraftRevision?: number | null; basePublishedVersionNumber?: number | null }`; `previewImport(args: PreviewImportArgs): Promise<PreviewResult>`.
- Produces: nothing consumed by later tasks. This is a gate.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/instrument-round-trip.test.ts
import { describe, expect, it } from "vitest";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import { blankInstrumentDocument } from "@/lib/instrument-draft";
import { exportWorkbook } from "@/lib/instrument-template/workbook";
import { previewImport } from "@/lib/instrument-template/merge";

const coreDocument = parseInstrumentDocument(CORE_V1_DOCUMENT);

describe("export then import as a new assessment", () => {
  it("accepts a template export with no base identity", async () => {
    const bytes = await exportWorkbook(coreDocument, {
      sourceMode: "strict",
      baseAssessmentId: null,
    });
    const result = await previewImport({
      format: "xlsx",
      bytes,
      target: null,
      targetId: null,
      liveDraftRevision: null,
      livePublishedVersionNumber: null,
    });
    expect(result).not.toHaveProperty("refuse");
    if ("refuse" in result) return;
    expect(result.issues.filter((i) => i.severity === "hard")).toEqual([]);
    expect(result.committable).toBe(true);
  });

  it("accepts an assessment export re-imported as a new assessment", async () => {
    const bytes = await exportWorkbook(coreDocument, {
      sourceMode: "strict",
      baseAssessmentId: "asmt_source",
      baseDraftRevision: 3,
      basePublishedVersionNumber: 2,
    });
    const result = await previewImport({
      format: "xlsx",
      bytes,
      target: null,
      targetId: null,
      liveDraftRevision: null,
      livePublishedVersionNumber: null,
    });
    expect(result).not.toHaveProperty("refuse");
    if ("refuse" in result) return;
    expect(result.issues.filter((i) => i.severity === "hard")).toEqual([]);
  });

  it("refuses an export of A imported into B", async () => {
    const bytes = await exportWorkbook(coreDocument, {
      sourceMode: "strict",
      baseAssessmentId: "asmt_a",
      baseDraftRevision: 1,
      basePublishedVersionNumber: 1,
    });
    const result = await previewImport({
      format: "xlsx",
      bytes,
      target: coreDocument,
      targetId: "asmt_b",
      liveDraftRevision: 1,
      livePublishedVersionNumber: 1,
    });
    expect(result).toHaveProperty("refuse");
  });

  it("round-trips a blank draft template", async () => {
    const blank = blankInstrumentDocument();
    const bytes = await exportWorkbook(blank, { sourceMode: "draft", baseAssessmentId: null });
    const result = await previewImport({
      format: "xlsx",
      bytes,
      target: null,
      targetId: null,
      liveDraftRevision: null,
      livePublishedVersionNumber: null,
    });
    expect(result).not.toHaveProperty("refuse");
    if ("refuse" in result) return;
    expect(result.sourceMode).toBe("draft");
    expect(result.issues.filter((i) => i.severity === "hard")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and read what actually happens**

Run: `pnpm test tests/unit/instrument-round-trip.test.ts`

This is a probe, not a red-green cycle — the library already exists, so some of these may pass immediately. Record which fail and with what message.

- [ ] **Step 3: If any fail, fix `merge.ts`, not the test**

The likely culprit is the base-identity comparison in `previewImportXlsx`. Read how `normalizeAssessmentId` is used against `baseAssessmentId` and `args.targetId`. The intended rule, from D24 §16: a null `targetId` means "create", and a create must ignore `baseAssessmentId` entirely rather than compare it. Only when `targetId` is non-null does a mismatch mean "this file came from a different assessment" and refuse.

Do not weaken the third test — refusing A-into-B is the behaviour that protects against pasting the wrong export over an instrument.

- [ ] **Step 4: Run the full suite**

Run: `pnpm test`
Expected: all pass, 528 + 4 new.

- [ ] **Step 5: Run the invariant check bare**

Run: `bash .claude/skills/afenda-talents-build/check-invariants.sh`
Expected: mechanical invariants pass.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/instrument-round-trip.test.ts src/lib/instrument-template/merge.ts
git commit -m "test: prove export imports back as a new assessment"
```

---

### Task 2: Assessment kind helpers and key allocator

Spec §6.4. `instrument-kind.ts` exists only in commit `32c3b45`. D24 §10 refers to an allocator that was never on main.

**Files:**
- Create: `src/lib/instrument-kind.ts`
- Test: `tests/unit/instrument-kind.test.ts`

**Interfaces:**
- Produces, relied on by Tasks 4 and 6:
  - `normalizeAssessmentKey(key: string): string`
  - `isReservedAssessmentKey(key: string): boolean`
  - `kindFlags(kind: AssessmentKind): { kind: AssessmentKind; isSystem: boolean }`
  - `allocateAssessmentKey(kind: "TEMPLATE" | "ORGANISATION"): string`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/instrument-kind.test.ts
import { describe, expect, it } from "vitest";
import {
  allocateAssessmentKey,
  isReservedAssessmentKey,
  kindFlags,
  normalizeAssessmentKey,
} from "@/lib/instrument-kind";

describe("normalizeAssessmentKey", () => {
  it("trims, NFKC-normalises and lowercases", () => {
    expect(normalizeAssessmentKey("  Afenda-Core  ")).toBe("afenda-core");
  });
});

describe("isReservedAssessmentKey", () => {
  it("reserves the afenda- prefix after normalisation", () => {
    expect(isReservedAssessmentKey("  AFENDA-anything ")).toBe(true);
  });

  it("allows other prefixes", () => {
    expect(isReservedAssessmentKey("org-1a2b3c")).toBe(false);
  });
});

describe("kindFlags", () => {
  it("derives isSystem from kind so the two cannot disagree", () => {
    expect(kindFlags("SYSTEM")).toEqual({ kind: "SYSTEM", isSystem: true });
    expect(kindFlags("TEMPLATE")).toEqual({ kind: "TEMPLATE", isSystem: false });
    expect(kindFlags("ORGANISATION")).toEqual({ kind: "ORGANISATION", isSystem: false });
  });
});

describe("allocateAssessmentKey", () => {
  it("prefixes by kind", () => {
    expect(allocateAssessmentKey("ORGANISATION")).toMatch(/^org-[0-9a-f]{12}$/);
    expect(allocateAssessmentKey("TEMPLATE")).toMatch(/^tpl-[0-9a-f]{12}$/);
  });

  it("never collides across many allocations", () => {
    const keys = new Set(
      Array.from({ length: 500 }, () => allocateAssessmentKey("ORGANISATION")),
    );
    expect(keys.size).toBe(500);
  });

  it("never allocates a reserved key", () => {
    expect(isReservedAssessmentKey(allocateAssessmentKey("ORGANISATION"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/instrument-kind.test.ts`
Expected: FAIL — `Cannot find module '@/lib/instrument-kind'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/instrument-kind.ts
/**
 * Assessment kind and key rules (D24 §10). Pure module — no Prisma.
 *
 * `isSystem` is derived from `kind` rather than stored independently, so a row
 * cannot claim to be an ORGANISATION assessment while carrying system privileges.
 */
import { randomBytes } from "node:crypto";
import type { AssessmentKind } from "@/generated/prisma/enums";

export function normalizeAssessmentKey(key: string): string {
  return key.trim().normalize("NFKC").toLowerCase();
}

/** `afenda-` belongs to seed-owned instruments and can never be imported. */
export function isReservedAssessmentKey(key: string): boolean {
  return normalizeAssessmentKey(key).startsWith("afenda-");
}

export function kindFlags(kind: AssessmentKind): {
  kind: AssessmentKind;
  isSystem: boolean;
} {
  return { kind, isSystem: kind === "SYSTEM" };
}

/**
 * Server-side key for an imported assessment. Any key in the uploaded payload is
 * ignored — a file cannot name itself into an existing row, or into the reserved
 * namespace.
 */
export function allocateAssessmentKey(kind: "TEMPLATE" | "ORGANISATION"): string {
  const prefix = kind === "TEMPLATE" ? "tpl" : "org";
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/instrument-kind.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/instrument-kind.ts tests/unit/instrument-kind.test.ts
git commit -m "feat: assessment kind helpers and import key allocator"
```

---

### Task 3: Refuse imports that target a SYSTEM assessment

Spec §6.1. This is the live defect: an upload can currently overwrite Core v1 or the Sales instrument.

**Files:**
- Modify: `src/app/api/admin/assessments/import/preview/route.ts`
- Modify: `src/app/api/admin/assessments/import/commit/route.ts`
- Test: `tests/unit/instrument-import-guards.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `assertImportableTarget(assessment: { isSystem: boolean; kind: string; status: string }): void` exported from `src/lib/instrument-import.ts`, throwing `ImportTargetError` with a `status` field. Task 4 reuses it.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/instrument-import-guards.test.ts
import { describe, expect, it } from "vitest";
import { ImportTargetError, assertImportableTarget } from "@/lib/instrument-import";

describe("assertImportableTarget", () => {
  it("accepts an organisation assessment", () => {
    expect(() =>
      assertImportableTarget({ isSystem: false, kind: "ORGANISATION", status: "DRAFT" }),
    ).not.toThrow();
  });

  it("accepts a template assessment", () => {
    expect(() =>
      assertImportableTarget({ isSystem: false, kind: "TEMPLATE", status: "PUBLISHED" }),
    ).not.toThrow();
  });

  it("refuses a SYSTEM kind", () => {
    expect(() =>
      assertImportableTarget({ isSystem: false, kind: "SYSTEM", status: "PUBLISHED" }),
    ).toThrow(ImportTargetError);
  });

  it("refuses an isSystem row even if the kind disagrees", () => {
    expect(() =>
      assertImportableTarget({ isSystem: true, kind: "ORGANISATION", status: "PUBLISHED" }),
    ).toThrow(ImportTargetError);
  });

  it("refuses an archived assessment", () => {
    expect(() =>
      assertImportableTarget({ isSystem: false, kind: "ORGANISATION", status: "ARCHIVED" }),
    ).toThrow(ImportTargetError);
  });

  it("reports 409 so the route does not have to map it", () => {
    try {
      assertImportableTarget({ isSystem: true, kind: "SYSTEM", status: "PUBLISHED" });
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ImportTargetError);
      expect((error as ImportTargetError).status).toBe(409);
    }
  });

  it("says why, naming the instrument as seed-owned", () => {
    try {
      assertImportableTarget({ isSystem: true, kind: "SYSTEM", status: "PUBLISHED" });
      throw new Error("expected a throw");
    } catch (error) {
      expect((error as Error).message).toMatch(/seed-owned/i);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/instrument-import-guards.test.ts`
Expected: FAIL — `assertImportableTarget` is not exported.

- [ ] **Step 3: Add the guard to `src/lib/instrument-import.ts`**

Append to that file:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/instrument-import-guards.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Call the guard from the preview route**

In `src/app/api/admin/assessments/import/preview/route.ts`, replace the existing archived-only check inside `if (targetId) { ... }`:

```ts
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    try {
      assertImportableTarget(assessment);
    } catch (error) {
      if (error instanceof ImportTargetError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
```

Add `assertImportableTarget, ImportTargetError` to the existing import from `@/lib/instrument-import`.

- [ ] **Step 6: Call the guard from the commit route**

In `src/app/api/admin/assessments/import/commit/route.ts`, inside the transaction, replace the archived-only check after the assessment is re-read:

```ts
        if (!assessment) throw new ImportCommitError("Not found", 404);
        try {
          assertImportableTarget(assessment);
        } catch (error) {
          if (error instanceof ImportTargetError) {
            throw new ImportCommitError(error.message, error.status);
          }
          throw error;
        }
```

Add `assertImportableTarget, ImportTargetError` to the existing import from `@/lib/instrument-import`.

- [ ] **Step 7: Verify the whole gate**

Run each and paste the output:

```
pnpm typecheck
pnpm lint
pnpm test
```

Then, bare and unpiped:

```
bash .claude/skills/afenda-talents-build/check-invariants.sh
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/instrument-import.ts src/app/api/admin/assessments/import tests/unit/instrument-import-guards.test.ts
git commit -m "fix: refuse imports that target a seed-owned SYSTEM assessment"
```

---

### Task 4: Choose kind and allocate a key when import creates

Spec §6.2 and §6.3. Today the create path hardcodes `ORGANISATION` and leaves `key: null`.

**Files:**
- Modify: `src/lib/instrument-import.ts` (schema)
- Modify: `src/app/api/admin/assessments/import/commit/route.ts`
- Test: `tests/unit/instrument-import.test.ts` (extend)

**Interfaces:**
- Consumes: `allocateAssessmentKey`, `kindFlags` from Task 2.
- Produces: `importCommitSchema` now carries `targetKind: "TEMPLATE" | "ORGANISATION"`, defaulting to `"ORGANISATION"`. Task 10's dialog sends it.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/instrument-import.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/instrument-import.test.ts`
Expected: FAIL — `targetKind` is `undefined`, and `SYSTEM` is accepted because the field does not exist.

- [ ] **Step 3: Extend the schema**

In `src/lib/instrument-import.ts`, change `importCommitSchema`:

```ts
export const importCommitSchema = importPreviewSchema.extend({
  /** sha256 of the document the admin approved in the preview. */
  previewHash: z.string().regex(/^[0-9a-f]{64}$/),
  /** Kind for a create. SYSTEM is deliberately unreachable through the API. */
  targetKind: z.enum(["TEMPLATE", "ORGANISATION"]).default("ORGANISATION"),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/instrument-import.test.ts`
Expected: PASS.

- [ ] **Step 5: Use the kind and allocate a key on create**

In `src/app/api/admin/assessments/import/commit/route.ts`, destructure `targetKind` alongside the rest, and replace the create block's `data`:

```ts
      const created = await db.assessment.create({
        data: {
          key: allocateAssessmentKey(targetKind),
          title: draft.title,
          ...kindFlags(targetKind),
          status: "DRAFT",
          draftDocument: draft,
        },
      });
```

Add the import:

```ts
import { allocateAssessmentKey, kindFlags } from "@/lib/instrument-kind";
```

Leave the update path alone — the target row's key is unchanged by design (D24 §10).

- [ ] **Step 6: Verify the whole gate**

Run each and paste the output: `pnpm typecheck`, `pnpm lint`, `pnpm test`, then bare `bash .claude/skills/afenda-talents-build/check-invariants.sh`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/instrument-import.ts src/app/api/admin/assessments/import/commit/route.ts tests/unit/instrument-import.test.ts
git commit -m "feat: choose kind and allocate a key when import creates an assessment"
```

---

### Task 5: Download registry and shared filename helper

Spec §5. Also extracts `filePart` out of `src/app/api/admin/export/route.ts`, where it is private, so both download routes and the existing results export share one slugifier.

**Files:**
- Create: `src/lib/instrument-download.ts`
- Modify: `src/app/api/admin/export/route.ts`
- Test: `tests/unit/instrument-download.test.ts`

**Interfaces:**
- Produces, relied on by Tasks 6 and 7:
  - `DOWNLOAD_FORMATS: readonly ["xlsx", "json", "csv"]`
  - `TEMPLATE_KINDS: readonly ["blank", "core", "sales"]`
  - `type DownloadFormat`, `type TemplateKind`
  - `templateDocument(kind: TemplateKind): { document: unknown; sourceMode: "strict" | "draft"; title: string }`
  - `downloadHeaders(format: DownloadFormat, name: string): Record<string, string>`
  - `filePart(value: string): string`
  - `resolveExportSource(args: { source: "draft" | "published"; draftDocument: unknown | null; latestDocument: unknown | null }): { document: unknown } | { error: string }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/instrument-download.test.ts
import { describe, expect, it } from "vitest";
import { parseInstrumentDocument } from "@/lib/instrument-document";
import {
  DOWNLOAD_FORMATS,
  TEMPLATE_KINDS,
  downloadHeaders,
  filePart,
  templateDocument,
} from "@/lib/instrument-download";

describe("filePart", () => {
  it("slugifies a title", () => {
    expect(filePart("Sales Performance & Role Positioning")).toBe(
      "sales-performance-role-positioning",
    );
  });

  it("falls back when nothing survives", () => {
    expect(filePart("!!!")).toBe("instrument");
  });
});

describe("downloadHeaders", () => {
  it("sets an xlsx content type and attachment filename", () => {
    const headers = downloadHeaders("xlsx", "Core v1");
    expect(headers["Content-Type"]).toContain("spreadsheetml");
    expect(headers["Content-Disposition"]).toBe(
      'attachment; filename="afenda-core-v1.xlsx"',
    );
    expect(headers["Cache-Control"]).toBe("private, no-store");
  });

  it("sets json and csv content types", () => {
    expect(downloadHeaders("json", "x")["Content-Type"]).toContain("application/json");
    expect(downloadHeaders("csv", "x")["Content-Type"]).toContain("text/csv");
  });
});

describe("templateDocument", () => {
  it("covers every declared kind", () => {
    for (const kind of TEMPLATE_KINDS) {
      const entry = templateDocument(kind);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(() => parseInstrumentDocument(entry.document)).not.toThrow();
    }
  });

  it("marks the blank skeleton as a draft, since strict parse would reject it", () => {
    expect(templateDocument("blank").sourceMode).toBe("draft");
  });

  it("marks filled examples as strict", () => {
    expect(templateDocument("core").sourceMode).toBe("strict");
    expect(templateDocument("sales").sourceMode).toBe("strict");
  });

  it("declares three formats", () => {
    expect([...DOWNLOAD_FORMATS]).toEqual(["xlsx", "json", "csv"]);
  });
});

describe("resolveExportSource", () => {
  it("returns the draft when one is open", () => {
    expect(
      resolveExportSource({
        source: "draft",
        draftDocument: { title: "draft" },
        latestDocument: { title: "published" },
      }),
    ).toEqual({ document: { title: "draft" } });
  });

  it("falls back to the published document when no draft is open", () => {
    expect(
      resolveExportSource({
        source: "draft",
        draftDocument: null,
        latestDocument: { title: "published" },
      }),
    ).toEqual({ document: { title: "published" } });
  });

  it("returns the published document when asked for it, ignoring an open draft", () => {
    expect(
      resolveExportSource({
        source: "published",
        draftDocument: { title: "draft" },
        latestDocument: { title: "published" },
      }),
    ).toEqual({ document: { title: "published" } });
  });

  it("errors when asked for published and there is none", () => {
    const result = resolveExportSource({
      source: "published",
      draftDocument: { title: "draft" },
      latestDocument: null,
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/no published version/i);
  });

  it("errors when there is nothing at all to download", () => {
    const result = resolveExportSource({
      source: "draft",
      draftDocument: null,
      latestDocument: null,
    });
    expect(result).toHaveProperty("error");
  });
});
```

Add `resolveExportSource` to the import list at the top of this test file.

Note: `parseInstrumentDocument` on the blank skeleton is expected to succeed — `blankInstrumentDocument()` produces one complete Likert item. If it throws, relax that assertion to only the two strict kinds and record why.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/instrument-download.test.ts`
Expected: FAIL — `Cannot find module '@/lib/instrument-download'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/instrument-download.ts
/**
 * What a download offers and how it is framed as a file. Pure module — no Prisma.
 *
 * The kind list is the single source for the Zod enum, the dialog options, and the
 * registry below, so shipping another example instrument is one entry rather than
 * four edits. `tests/unit/shipped-documents.test.ts` guards the same documents.
 */
import salesPerformanceRaw from "../../data/Sales_Performance_Role_Positioning_Assessment.json";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";
import { blankInstrumentDocument } from "@/lib/instrument-draft";

export const DOWNLOAD_FORMATS = ["xlsx", "json", "csv"] as const;
export type DownloadFormat = (typeof DOWNLOAD_FORMATS)[number];

export const TEMPLATE_KINDS = ["blank", "core", "sales"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

const CONTENT_TYPE: Record<DownloadFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

export function filePart(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || "instrument";
}

export function downloadHeaders(
  format: DownloadFormat,
  name: string,
): Record<string, string> {
  return {
    "Content-Type": CONTENT_TYPE[format],
    "Content-Disposition": `attachment; filename="afenda-${filePart(name)}.${format}"`,
    "Cache-Control": "private, no-store",
  };
}

/**
 * `sourceMode: "draft"` on the blank skeleton is required, not cosmetic: a skeleton
 * is deliberately incomplete and a strict re-parse would reject it.
 */
export function templateDocument(kind: TemplateKind): {
  document: unknown;
  sourceMode: "strict" | "draft";
  title: string;
} {
  switch (kind) {
    case "blank":
      return {
        document: blankInstrumentDocument("Untitled assessment"),
        sourceMode: "draft",
        title: "instrument template",
      };
    case "core":
      return { document: CORE_V1_DOCUMENT, sourceMode: "strict", title: "core example" };
    case "sales":
      return {
        document: salesPerformanceRaw,
        sourceMode: "strict",
        title: "sales example",
      };
  }
}

/**
 * Which document a download should carry. Split out of the route so the fallback
 * rules are testable without a database: asking for the draft of an assessment
 * with no open draft gets the latest published document, which is what the builder
 * shows in the same situation.
 */
export function resolveExportSource(args: {
  source: "draft" | "published";
  draftDocument: unknown | null;
  latestDocument: unknown | null;
}): { document: unknown } | { error: string } {
  if (args.source === "published") {
    if (args.latestDocument === null) {
      return { error: "This assessment has no published version yet" };
    }
    return { document: args.latestDocument };
  }
  const document = args.draftDocument ?? args.latestDocument;
  if (document === null || document === undefined) {
    return { error: "This assessment has nothing to download yet" };
  }
  return { document };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/instrument-download.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Point the results export at the shared helper**

In `src/app/api/admin/export/route.ts`, delete the private `filePart` function (lines ~22-29) and import the shared one:

```ts
import { filePart } from "@/lib/instrument-download";
```

Its existing call site becomes `filePart(selected.name)` unchanged. Note the fallback string changes from `"round"` to `"instrument"`; that only shows for a round whose name is entirely punctuation.

- [ ] **Step 6: Verify the whole gate**

Run each and paste the output: `pnpm typecheck`, `pnpm lint`, `pnpm test`, then bare `bash .claude/skills/afenda-talents-build/check-invariants.sh`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/instrument-download.ts tests/unit/instrument-download.test.ts src/app/api/admin/export/route.ts
git commit -m "feat: instrument download registry and shared filename helper"
```

---

### Task 6: `GET /api/admin/assessments/template`

Spec §4 and §4.1. The template carries **no base identity** — that is what makes it read as "create" rather than "update this SYSTEM row".

**Files:**
- Create: `src/app/api/admin/assessments/template/route.ts`
- Test: `tests/unit/instrument-round-trip.test.ts` (extend)

**Interfaces:**
- Consumes: `templateDocument`, `downloadHeaders`, `DOWNLOAD_FORMATS`, `TEMPLATE_KINDS` from Task 5; `exportWorkbook`, `exportCsv`.
- Produces: the endpoint Task 8's dialog calls.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/instrument-round-trip.test.ts`:

```ts
import { exportCsv } from "@/lib/instrument-template/csv";
import { templateDocument } from "@/lib/instrument-download";

describe("every template downloads and imports back", () => {
  it.each(["blank", "core", "sales"] as const)(
    "%s round-trips through xlsx with no base identity",
    async (kind) => {
      const entry = templateDocument(kind);
      const bytes = await exportWorkbook(entry.document, {
        sourceMode: entry.sourceMode,
        baseAssessmentId: null,
      });
      const result = await previewImport({
        format: "xlsx",
        bytes,
        target: null,
        targetId: null,
        liveDraftRevision: null,
        livePublishedVersionNumber: null,
      });
      expect(result).not.toHaveProperty("refuse");
      if ("refuse" in result) return;
      expect(result.issues.filter((i) => i.severity === "hard")).toEqual([]);
    },
  );

  it("produces a non-empty CSV for a filled example", () => {
    const csv = exportCsv(templateDocument("sales").document);
    expect(csv.length).toBeGreaterThan(0);
    expect(csv.toString("utf8").split("\n").length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `pnpm test tests/unit/instrument-round-trip.test.ts`

These exercise the library directly, so they may pass before the route exists. That is fine — they are the contract the route must not break. Record the result.

- [ ] **Step 3: Write the route**

```ts
// src/app/api/admin/assessments/template/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHiringUser } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import {
  DOWNLOAD_FORMATS,
  TEMPLATE_KINDS,
  downloadHeaders,
  templateDocument,
} from "@/lib/instrument-download";
import { exportCsv } from "@/lib/instrument-template/csv";
import { exportWorkbook } from "@/lib/instrument-template/workbook";

export const runtime = "nodejs";

const querySchema = z.object({
  kind: z.enum(TEMPLATE_KINDS).default("blank"),
  format: z.enum(DOWNLOAD_FORMATS).default("xlsx"),
});

/**
 * A blank skeleton or a filled example to author from.
 *
 * `_Source` carries no `baseAssessmentId` (spec §4.1). That is deliberate: it is
 * what tells the importer this file is a new instrument rather than an edit of the
 * assessment it was generated from — otherwise downloading the Core example and
 * uploading it would present as an attempt to overwrite a seed-owned row.
 */
export async function GET(request: Request) {
  let session;
  try {
    session = await requireHiringUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    kind: url.searchParams.get("kind") ?? undefined,
    format: url.searchParams.get("format") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown template or format" }, { status: 400 });
  }

  const { kind, format } = parsed.data;
  const entry = templateDocument(kind);

  await audit(session.userId, "export.downloaded", undefined, {
    template: kind,
    format,
  });

  const headers = downloadHeaders(format, entry.title);

  if (format === "json") {
    return new NextResponse(JSON.stringify(entry.document, null, 2), { headers });
  }
  if (format === "csv") {
    return new NextResponse(exportCsv(entry.document) as unknown as BodyInit, { headers });
  }
  const workbook = await exportWorkbook(entry.document, {
    sourceMode: entry.sourceMode,
    baseAssessmentId: null,
  });
  return new NextResponse(workbook as unknown as BodyInit, { headers });
}
```

- [ ] **Step 4: Verify the route builds and is registered**

Run: `pnpm build`
Expected: exit 0, and the output lists `/api/admin/assessments/template`.

- [ ] **Step 5: Verify the whole gate**

Run each and paste the output: `pnpm typecheck`, `pnpm lint`, `pnpm test`, then bare `bash .claude/skills/afenda-talents-build/check-invariants.sh`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/assessments/template/route.ts tests/unit/instrument-round-trip.test.ts
git commit -m "feat: download a blank or example instrument template"
```

---

### Task 7: `GET /api/admin/assessments/[id]/export`

Spec §4. Unlike the template route, this one stamps the real base identity so a re-upload into the same assessment is recognised as an update.

**Files:**
- Create: `src/app/api/admin/assessments/[id]/export/route.ts`

**Interfaces:**
- Consumes: `downloadHeaders`, `DOWNLOAD_FORMATS` from Task 5.
- Produces: the endpoint Task 9's row action calls.

- [ ] **Step 1: Write the route**

The decision logic lives in `resolveExportSource`, already tested in Task 5. What remains here is database wiring, covered by the build and by the manual walk at the end of this plan.

```ts
// src/app/api/admin/assessments/[id]/export/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHiringUser } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  DOWNLOAD_FORMATS,
  downloadHeaders,
  resolveExportSource,
} from "@/lib/instrument-download";
import { exportCsv } from "@/lib/instrument-template/csv";
import { exportWorkbook } from "@/lib/instrument-template/workbook";

export const runtime = "nodejs";

const querySchema = z.object({
  format: z.enum(DOWNLOAD_FORMATS).default("xlsx"),
  source: z.enum(["draft", "published"]).default("draft"),
});

/**
 * Download one assessment. `_Source` stamps the real base identity, so re-uploading
 * into this same assessment is recognised as an update and re-uploading as a new
 * assessment still works (D24 §16).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireHiringUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    format: url.searchParams.get("format") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown format or source" }, { status: 400 });
  }
  const { format, source } = parsed.data;

  const { id } = await params;
  const assessment = await db.assessment.findUnique({
    where: { id },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!assessment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const latest = assessment.versions[0] ?? null;

  const resolved = resolveExportSource({
    source,
    draftDocument: assessment.draftDocument,
    latestDocument: latest?.document ?? null,
  });
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 409 });
  }
  const { document } = resolved;

  await audit(session.userId, "export.downloaded", assessment.id, {
    format,
    source,
  });

  const headers = downloadHeaders(format, assessment.title);

  if (format === "json") {
    return new NextResponse(JSON.stringify(document, null, 2), { headers });
  }
  if (format === "csv") {
    return new NextResponse(exportCsv(document) as unknown as BodyInit, { headers });
  }
  const workbook = await exportWorkbook(document, {
    sourceMode: source === "published" ? "strict" : "draft",
    baseAssessmentId: assessment.id,
    baseDraftRevision: assessment.draftRevision,
    basePublishedVersionNumber: latest?.versionNumber ?? null,
  });
  return new NextResponse(workbook as unknown as BodyInit, { headers });
}
```

- [ ] **Step 2: Verify the route builds and is registered**

Run: `pnpm build`
Expected: exit 0, and the output lists `/api/admin/assessments/[id]/export`.

- [ ] **Step 3: Verify the whole gate**

Run each and paste the output: `pnpm typecheck`, `pnpm lint`, `pnpm test`, then bare `bash .claude/skills/afenda-talents-build/check-invariants.sh`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/admin/assessments/[id]/export/route.ts"
git commit -m "feat: download an assessment as xlsx, JSON or CSV"
```

---

### Task 8: Download-template dialog in the page header

Spec §8. Follows `assessments-toolbar.tsx` conventions: `Dialog`, `DialogTrigger render={<Button />}`, `Alert`, `Label`. Base UI, so no `asChild`.

**Files:**
- Create: `src/components/assessment-builder/download-template-button.tsx`
- Modify: `src/app/admin/(shell)/assessments/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/assessments/template` from Task 6; the `DownloadFormat` and `TemplateKind` **types** from Task 5 (the values are spelled out in local copy arrays so each option can carry its own hint).
- Produces: `<DownloadTemplateButton />`, no props.

- [ ] **Step 1: Write the component**

```tsx
// src/components/assessment-builder/download-template-button.tsx
"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { DownloadFormat, TemplateKind } from "@/lib/instrument-download";

const KIND_COPY: Array<{ value: TemplateKind; label: string; hint: string }> = [
  {
    value: "blank",
    label: "Blank template",
    hint: "Empty structure with one worked row and Excel dropdowns.",
  },
  {
    value: "core",
    label: "Core example",
    hint: "The behavioural profile, filled in — five dimensions, three bands.",
  },
  {
    value: "sales",
    label: "Sales example",
    hint: "A larger instrument — twelve dimensions, five bands, six essays.",
  },
];

const FORMAT_COPY: Array<{ value: DownloadFormat; label: string; hint: string }> = [
  { value: "xlsx", label: "Excel", hint: "Dropdowns and one sheet per part. Best for authoring." },
  { value: "json", label: "JSON", hint: "Full fidelity, for ops." },
  {
    value: "csv",
    label: "CSV",
    hint: "Items only. Updates an assessment that already exists — it cannot create one.",
  },
];

/** Download a starting point. Nothing is written, so there is no preview step. */
export function DownloadTemplateButton() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TemplateKind>("blank");
  const [format, setFormat] = useState<DownloadFormat>("xlsx");

  const formatHint = FORMAT_COPY.find((f) => f.value === format)?.hint ?? "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <DownloadIcon />
        Download template
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download a template</DialogTitle>
          <DialogDescription>
            Author the instrument offline, then upload it with Import. Nothing here
            changes the workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <Label className="flex flex-col gap-1.5">
            Starting point
            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as TemplateKind)}
            >
              {KIND_COPY.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              {KIND_COPY.find((k) => k.value === kind)?.hint}
            </span>
          </Label>

          <Label className="flex flex-col gap-1.5">
            Format
            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={format}
              onChange={(e) => setFormat(e.target.value as DownloadFormat)}
            >
              {FORMAT_COPY.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">{formatHint}</span>
          </Label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            nativeButton={false}
            render={
              <a
                href={`/api/admin/assessments/template?kind=${kind}&format=${format}`}
                download
              />
            }
            onClick={() => setOpen(false)}
          >
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire it into the page header**

In `src/app/admin/(shell)/assessments/page.tsx`, add the import and place it first in the actions group:

```tsx
import { DownloadTemplateButton } from "@/components/assessment-builder/download-template-button";
```

```tsx
				actions={
					isAdmin ? (
						<div className="flex flex-wrap items-center gap-2">
							<DownloadTemplateButton />
							<ImportAssessmentButton />
							<NewAssessmentButton />
						</div>
					) : undefined
				}
```

- [ ] **Step 3: Verify the whole gate**

Run each and paste the output: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, then bare `bash .claude/skills/afenda-talents-build/check-invariants.sh`.

- [ ] **Step 4: Commit**

```bash
git add src/components/assessment-builder/download-template-button.tsx "src/app/admin/(shell)/assessments/page.tsx"
git commit -m "feat: download-template dialog on the assessments page"
```

---

### Task 9: Per-row download action

Spec §8. Available to VIEWER, matching the existing Preview affordance.

**Files:**
- Create: `src/components/assessment-builder/download-assessment-button.tsx`
- Modify: `src/app/admin/(shell)/assessments/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/assessments/[id]/export` from Task 7.
- Produces: `<DownloadAssessmentButton assessmentId={string} hasPublishedVersion={boolean} />`.

- [ ] **Step 1: Write the component**

```tsx
// src/components/assessment-builder/download-assessment-button.tsx
"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { DownloadFormat } from "@/lib/instrument-download";

/** Row action: download this assessment to edit offline and upload back. */
export function DownloadAssessmentButton({
  assessmentId,
  hasPublishedVersion,
}: {
  assessmentId: string;
  hasPublishedVersion: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<DownloadFormat>("xlsx");
  const [source, setSource] = useState<"draft" | "published">(
    hasPublishedVersion ? "published" : "draft",
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <DownloadIcon />
        Download
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download this assessment</DialogTitle>
          <DialogDescription>
            Edit it offline and upload it back with Import. Excel keeps a hidden record
            of where it came from, so the upload knows what changed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <Label className="flex flex-col gap-1.5">
            Version
            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={source}
              onChange={(e) => setSource(e.target.value as "draft" | "published")}
            >
              <option value="draft">Current draft</option>
              <option value="published" disabled={!hasPublishedVersion}>
                Latest published
              </option>
            </select>
            <span className="text-xs text-muted-foreground">
              {hasPublishedVersion
                ? "The draft falls back to the latest published version when no draft is open."
                : "This assessment has no published version yet."}
            </span>
          </Label>

          <Label className="flex flex-col gap-1.5">
            Format
            <select
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
              value={format}
              onChange={(e) => setFormat(e.target.value as DownloadFormat)}
            >
              <option value="xlsx">Excel</option>
              <option value="json">JSON</option>
              <option value="csv">CSV — items only</option>
            </select>
          </Label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            nativeButton={false}
            render={
              <a
                href={`/api/admin/assessments/${assessmentId}/export?format=${format}&source=${source}`}
                download
              />
            }
            onClick={() => setOpen(false)}
          >
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire it into the row actions**

The row actions live in the `AssessmentRowActions` component at the bottom of `src/app/admin/(shell)/assessments/page.tsx` (around line 195). It currently takes `{ assessmentId, isAdmin, archived }`.

Add the import:

```tsx
import { DownloadAssessmentButton } from "@/components/assessment-builder/download-assessment-button";
```

Add a fourth prop to both the signature and its type:

```tsx
function AssessmentRowActions({
	assessmentId,
	isAdmin,
	archived,
	hasPublishedVersion,
}: {
	assessmentId: string;
	isAdmin: boolean;
	archived: boolean;
	hasPublishedVersion: boolean;
}) {
```

Render it immediately after the Preview `Button` and **outside** the `{isAdmin && !archived && (...)}` block, so VIEWER can download just as it can preview:

```tsx
			<DownloadAssessmentButton
				assessmentId={assessmentId}
				hasPublishedVersion={hasPublishedVersion}
			/>
```

Then pass the prop at the call site. The row objects built earlier in the file already carry `latestVersion`, so it is `hasPublishedVersion={row.latestVersion !== null}` — check the exact field name on the row before typing it.

- [ ] **Step 3: Verify the whole gate**

Run each and paste the output: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, then bare `bash .claude/skills/afenda-talents-build/check-invariants.sh`.

- [ ] **Step 4: Commit**

```bash
git add src/components/assessment-builder/download-assessment-button.tsx "src/app/admin/(shell)/assessments/page.tsx"
git commit -m "feat: per-row download action on the assessments list"
```

---

### Task 10: Kind toggle on the import dialog

Spec §6.2. Sends the `targetKind` added in Task 4.

**Files:**
- Modify: `src/components/assessment-builder/import-assessment-button.tsx`

**Interfaces:**
- Consumes: `importCommitSchema`'s `targetKind` from Task 4.

- [ ] **Step 1: Add the state**

Near the other `useState` calls:

```tsx
const [targetKind, setTargetKind] = useState<"TEMPLATE" | "ORGANISATION">("ORGANISATION");
```

- [ ] **Step 2: Send it on commit**

In `commit()`, add `targetKind` to the JSON body:

```tsx
				body: JSON.stringify({
					format: formatOf(file),
					targetId,
					content: await fileToBase64(file),
					previewHash: preview.documentHash,
					targetKind,
				}),
```

- [ ] **Step 3: Render the control, only when creating**

Immediately after the file `Label` in the form body. It is meaningless when `targetId` is set, because an update keeps the target's kind:

```tsx
{targetId === null && (
	<Label className="flex flex-col gap-1.5">
		Import as
		<select
			className="h-9 rounded-md border bg-transparent px-3 text-sm"
			value={targetKind}
			disabled={busy}
			onChange={(e) => setTargetKind(e.target.value as "TEMPLATE" | "ORGANISATION")}
		>
			<option value="ORGANISATION">Assessment — send this to candidates</option>
			<option value="TEMPLATE">Template — a blueprint to copy from</option>
		</select>
	</Label>
)}
```

- [ ] **Step 4: Verify the whole gate**

Run each and paste the output: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, then bare `bash .claude/skills/afenda-talents-build/check-invariants.sh`.

- [ ] **Step 5: Commit**

```bash
git add src/components/assessment-builder/import-assessment-button.tsx
git commit -m "feat: choose template or assessment when importing a new instrument"
```

---

## Manual verification

Automated tests cover the pure modules and the round-trip contract; the database wiring and the browser flow are not covered by `pnpm test`. Before calling this done, run the app and walk the loop once.

The local database needs attention first: port 54329 is currently held by Docker, not by `pnpm db:local`, so the project's embedded Postgres is not running and its credentials fail. Free the port or point `DATABASE_URL` at a database you control before starting.

1. `pnpm db:local` (leave running), then `pnpm prisma migrate deploy && pnpm db:seed`.
2. `pnpm dev`, sign in as an admin.
3. `/admin/assessments` → **Download template** → Blank / Excel. Open it: `Meta`, `Consent`, `Sections`, `Dimensions`, `Items`, `Bands`, `ContextRules` present; `Lists` hidden; `ContextRules` protected.
4. Change the title in `Meta`, add one item row in `Items`, save.
5. **Import** → choose the file → preview shows the change count → **Import** → lands in the builder on a new draft.
6. Confirm the new row shows kind **Assessment** and that its key starts with `org-`.
7. On a SYSTEM row (Core v1), confirm **Download** works and that importing into it is refused with the seed-owned message.
8. Round-trip a real one: **Download** the new assessment as Excel, edit an item, import it back into itself, confirm the diff names only that item.

## Definition of done

- Every task's commands run, output pasted.
- `pnpm lint` 0 warnings, `pnpm typecheck` clean, `pnpm test` all green, `pnpm build` clean.
- `check-invariants.sh` run bare, mechanical invariants pass.
- The manual walk above completed.
- Uploading into a SYSTEM assessment is refused at both preview and commit.

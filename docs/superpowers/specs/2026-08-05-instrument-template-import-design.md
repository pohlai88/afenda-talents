# Afenda Talents — Instrument template, import, and assessments ops

**Date:** 2026-08-05  
**Status:** Approved for implementation (revision 4)  
**Proposed decision:** D24  
**Depends on:** [D18 configurable assessments](./2026-08-05-configurable-assessments-design.md), [D21 two SYSTEM assessments](../../../DECISIONS.md), invariant 9  
**Does not authorise:** overwriting SYSTEM instruments; overall scores / ranks / percentiles; runtime writes into `docs/`; a separate Templates product nav

---

## 1. Overview

Administrators author instruments offline (Excel or JSON), upload them, see a **diff**, then explicitly commit a **TEMPLATE** or **ORGANISATION** draft. They can convert a template into an organisation assessment, export any non-secret snapshot, filter the assessments list by kind, compare versions, bulk-archive organisation/template drafts, and create a hiring round from a published version.

Canonical runtime shape remains `InstrumentDocument` schema v1 (`src/lib/instrument-document.ts`). Excel and CSV are skins. The server is the only validation gate.

The two compulsory SYSTEM assessments (`afenda-core-behavioural-profile`, `afenda-pre-joining-2026`) are **seed-owned**. They may be downloaded as examples. They must never be created, updated, or replaced by import.

**Interpretive call (locked):** visible-sheet hash mismatch means HR edited the workbook → **merge**, do not refuse. A typo fix in `Items` must not brick the file. Parse-level refuse only when `_Source` is missing, tampered, unreadable, or Google-stripped.

---

## 2. Goals

- HR can fill a workbook with dropdowns and known options; ops can round-trip full JSON.
- Upload never silently drops or lossily rewrites response-context rules.
- Entity identity (`Items`, `Sections`, `Dimensions`, `Bands`) is stable. `Items.order` is any number, then canonicalized to `1..n` per section.
- Import is two-phase: parse → validate → diff → commit. Commit replays the server-stored preview document.
- Import is **not stricter than Builder/publish**. Shared invariants only.
- Validation errors point at `Items!F14`, not `items[3].labels[1]`.
- Band cut-points have a declared unit; unreachable bands are flagged via the **same** check publish uses; `n = 0` is rejected before divide-by-zero.
- SYSTEM defaults stay protected. `afenda-` prefix is reserved after normalisation.
- Docs mirrors are generated in CI for SYSTEM/TEMPLATE only.

## 3. Non-goals

- Overwriting or minting `kind: SYSTEM` / `isSystem: true` via API or UI
- Per-dimension band tables (product bands are global; see §7)
- Importing `ContextRules` from Excel in v1 (export-only; edit rules via JSON)
- Collaborative multi-admin editing locks beyond optimistic base-version reject
- Google Sheets add-on, .xls (BIFF8), or LibreOffice-specific macros
- Runtime generation of files under `docs/`
- CSV creating sections, dimensions, consent, bands, or context rules; CSV **deleting** items
- Ranking, overall score, norms, or psychometric-validation claims in the template
- A global unique index on item / section / dimension / band ids
- Multi-tenant `orgId` (this product is one workspace). “Ownership” means the row exists here and is not SYSTEM.

---

## 4. Architecture

```text
GET  /api/admin/assessments/template?kind=blank|core|prejoining&format=xlsx|json|csv
GET  /api/admin/assessments/[id]/export?format=xlsx|json|csv&source=draft|published
POST /api/admin/assessments/import/preview     → parse + validate + diff (no draft write)
POST /api/admin/assessments/import/commit      → write server-stored preview document
POST /api/admin/assessments/[id]/convert       → TEMPLATE → new ORGANISATION draft
POST /api/admin/assessments/archive-many       → org/template only, never SYSTEM
POST /api/admin/assessments/compare            → diff two documents (ids or preview)
POST /api/admin/rounds                         → existing create + optional fromVersionId shortcut
```

Pure modules (no Prisma):

| Module | Responsibility |
|---|---|
| `lib/instrument-template/cells.ts` | `canonicalCell` — shared Excel coercion for every importable sheet + rules compare |
| `lib/instrument-template/visible.ts` | `projectVisible(document) → { importable, contextRules }` |
| `lib/instrument-template/workbook.ts` | xlsx ↔ document + chunked `_Source` (`veryHidden`) + provenance + zip limits |
| `lib/instrument-template/csv.ts` | items-only CSV **upsert** |
| `lib/instrument-template/diff.ts` | structured diff vs **target draft** |
| `lib/instrument-template/issues.ts` | Zod path → `Sheet!A1` |
| `lib/instrument-template/identity.ts` | mint / match / reject for item, section, dimension, band ids |
| `lib/instrument-template/bands.ts` | unit copy, mean helper, reachable sets |
| `lib/instrument-template/integrity.ts` | post-merge referential checks |
| `lib/instrument-invariants.ts` | **shared** publish + import hard checks (Builder parity) |

Prisma lives only in route handlers. `lib/scoring.ts` stays pure. Reachable-set helper may sit next to `scaleDimensionRaw`.

Upload limits (xlsx is an attacker-supplied zip):

| Limit | Value |
|---|---|
| Max upload bytes | 2 MiB |
| Max zip entries | 64 |
| Max decompressed `_Source` JSON | 512 KiB |
| Max **non-empty** cells (all sheets) | 20_000 |
| Max items | 500 |
| Max gzip ratio refusal | uncompressed claim > 20× compressed or > 512 KiB |

Cell counting uses **non-empty cells only**, not the worksheet `!ref` range (Excel often reports huge formatted-but-blank ranges).

Gzip for `_Source`: **mtime = 0**, **no filename field**. Byte-stability is claimed for the **`_Source` payload string only**, not the whole xlsx (zip entry mtimes and `docProps` timestamps vary). Optionally pin those too later; tests must not require full-file byte equality.

---

## 5. Round-trip contract (xlsx) — must not be lossy

### 5.1 Visible sheets

| Sheet | Role |
|---|---|
| `Meta` | **Document fields (importable):** title, internalDescription, candidateIntroduction, estimatedMinutes, displayMode, scoringMode. **Display-only (not importable, not in A3):** `baseAssessmentId`, `baseDraftRevision`, `basePublishedVersionNumber` — echo of `_Source` for humans. |
| `Consent` | purpose, whatWeCollect, whoSeesIt, retention |
| `Sections` | id, title, introduction, order |
| `Dimensions` | id, code, name, description, order |
| `Items` | type, id, order, text/body, required, sectionId, scored, dimensionId, reverseScored, helperText, maxLength, label1…label5 |
| `Bands` | id, name, minScaled, maxScaled (+ read-only mean helpers) |
| `ContextRules` | **Export-only in v1.** Sheet-protected. Not merged into the document. |
| `Lists` | hidden lookup values for Excel data validation only; not imported |

Dropdowns on `Lists` are ergonomics. Google Sheets often strips data validation and sheet protection. **Server validation is the only gate.**

If `Meta` display-only base cells disagree with `_Source` A4–A6, **`_Source` wins**. Editing those Meta cells must not change `H_now` and must not start a merge by itself.

`section.itemIds` is not authored as a column. Rebuilt after order canonicalization (§6.3).

### 5.2 `projectVisible` and A3 (single definition)

```ts
type VisibleProjection = {
  importable: {
    meta: { title, internalDescription, candidateIntroduction, estimatedMinutes, displayMode, scoringMode };
    consent: { purpose, whatWeCollect, whoSeesIt, retention };
    sections: Array<{ id, title, introduction, order }>;
    dimensions: Array<{ id, code, name, description, order }>;
    items: Array<{ /* importable item fields including canonical order */ }>;
    bands: Array<{ id, name, minScaled, maxScaled }>;
  };
  contextRules: Array<{ /* export projection of responseContextRules */ }>;
};
```

- `projectVisible(document)` is the only serializer.
- **A3 = `sha256(canonicalJson(projectVisible(document).importable))`.** Nothing else.
- `contextRules` is not part of A3.
- Display-only Meta base fields are **excluded** from `importable`.

### 5.3 Hidden `_Source` sheet

Excel cells cap at **32,767** characters. Chunk the gzip+base64 payload. Do not store `exportedVisible`.

At export:

1. Choose `sourceMode`: `strict` when exporting a published version or SYSTEM example; `draft` when exporting a draft (including blank template).
2. Zod-parse with that mode (`parseInstrumentDocument` vs `parseDraftDocument`).
3. `A3 = sha256(canonicalJson(projectVisible(document).importable))`.
4. `raw = canonicalJson(document)` (document only, sorted keys).
5. `payload = base64(gzip(utf8(raw), { mtime: 0, filename: "" }))`.
6. Split `payload` into chunks of **30,000** characters.

Layout — metadata in `A1:A10`, chunks contiguous in `B1..Bn`:

| Cell | Content |
|---|---|
| A1 | `afenda-instrument-source/v1` |
| A2 | `sourceMode`: `strict` or `draft` |
| A3 | importable visible hash (SHA-256 hex) |
| A4 | `baseAssessmentId` or empty |
| A5 | `baseDraftRevision` or empty |
| A6 | `basePublishedVersionNumber` or empty |
| A7 | SHA-256 hex of uncompressed `raw` UTF-8 bytes |
| A8 | `chunkCount` integer ≥ 1 |
| A9 | reserved empty |
| A10 | reserved empty |
| B1…Bn | `chunk[0]…chunk[n-1]` in order |

Plain values only. No formulas.

Reassembly: concat `B1..B{chunkCount}` → base64 decode → gunzip → UTF-8 → Zod parse using **A2 `sourceMode`**. Never spread untrusted JSON into a document.

A7 must equal `sha256(raw)` after gunzip, before Zod. Mismatch → parse-level refuse.

If `_Source` is missing, A1 wrong, A2 not `strict|draft`, `chunkCount` invalid, any `B` chunk missing, gunzip fails, A7 fails, or Zod fails → **parse-level refuse**. Message: re-download from Afenda or import JSON.

### 5.4 Import merge rules

| Document | Role |
|---|---|
| `_Source.document` | Preservation source for invisible fields (`responseContextRules` and future non-sheet keys) |
| **Current target draft** (empty skeleton on create) | Diff base — what commit overwrites |

Algorithm:

1. Parse visible importable sheets into a partial document + provenance. **Do not apply `ContextRules` sheet values to the merged document.**
2. Reassemble and Zod-parse `_Source` with `sourceMode` (§5.3). Failure → parse-level refuse.
3. `expected = projectVisible(sourceDocument)`.
4. Build `importableNow` from parsed sheets (same shape as `expected.importable`, after identity mint preview + order canonicalization). `H_now = sha256(canonicalJson(importableNow))`.
5. **ContextRules guard (not a parse refuse):**
   - If the `ContextRules` **sheet is absent** → treat as **untouched**. Do not compare to `expected.contextRules`. (Deleting a read-only sheet to “tidy up” must not brick the file.)
   - If the sheet is **present** → `canonicalCell`-normalize sheet rows and `expected.contextRules` (§5.5). If they differ → **hard preview issue** per changed rule id: “Response-context rule {id} looks different from the export. Excel cannot edit rules — leave this sheet alone or use JSON.” `committable` is false. Preview still shows the rest of the diff.
   - Export: sheet-protect `ContextRules`; mark `_Source` **`veryHidden`** (not merely hidden).
6. If `H_now === A3`: merged document = `sourceDocument`. Still run integrity, destination, stale, invariants, diff vs **target**.
7. If `H_now !== A3`: merge representable fields from sheets; copy `responseContextRules` and other non-sheet keys from `sourceDocument`.
8. **Destination guard (update):** `normalize(A4) === targetId`. Mismatch → parse-level refuse (“This workbook was exported from another assessment”). Create path: A4 may be empty.
9. **Stale base at preview:** update path if A5/A6 ≠ live target → `stale_base`, commit disabled, diff still returned.
10. Diff is always `diff(mergedDocument, targetDraft)`. Invisible-field reverts are explicit entries.
11. Referential integrity (§5.6) + shared invariants (§7.4).
12. Blank template: `_Source` with `sourceMode=draft`, empty rules, matching hashes.
13. No `_Source` → parse-level refuse. Greenfield without Excel uses JSON.

### 5.5 `canonicalCell` (every importable sheet + rules compare)

Excel coercions are not unique to `ContextRules`. `Items.required`, `scored`, `reverseScored`, `maxLength`, `Bands.minScaled` / `maxScaled`, and every `id` column suffer the same `TRUE`/`true`, `5` vs `5.0`, trailing spaces, empty vs null, and scientific-notation id mutations.

**One layer:** `canonicalCell(raw, kind)` used by importable parse **and** the ContextRules compare. Without it, `H_now` almost never equals A3 (fast path dies) and the merge path writes Excel-coerced junk into the document.

| `kind` | Behaviour |
|---|---|
| `text` | trim; `""` / null → empty |
| `bool` | `true`/`false`/`TRUE`/`1`/`0`/`yes`/`no` → boolean |
| `int` | canonical integer (reject locale junk) |
| `number` | `canonicalNumber` — integer if `Number.isInteger`, else trim trailing zeros |
| `id` | trim; if the display/string looks like scientific notation (`/e[+-]?\d+/i` after stringifying Excel’s value) → **hard issue on that cell**, do not silently accept |

Apply `id` kind to item, section, dimension, band, and rule ids.

`importableNow` and A3/`H_now` are computed **after** `canonicalCell`, so an untouched round-trip keeps the fast path (`H_now === A3`).

ContextRules compare (when the sheet is present) uses the same helpers, then canonical JSON of the rule array sorted by `id`.

### 5.6 Post-merge referential integrity (hard issues)

After merge, before diff:

- Every item `sectionId` exists in `Sections`.
- Every scored scale `dimensionId` exists in `Dimensions` and is non-null.
- Every `responseContextRules[].itemIds` entry and every `pairs[][]` id exists in `Items`.
- Every item id (including **info**) appears in **exactly one** section’s rebuilt `itemIds`. Orphan items → hard issue.
- Duplicate ids within items, sections, dimensions, or bands → hard issue.

---

## 6. Identity and order

All of these ids are **document-scoped**. No global unique indexes.

### 6.1 Items, sections, dimensions, bands

Same table for `Items.id`, `Sections.id`, `Dimensions.id`, `Bands.id`:

| Cell | Rule |
|---|---|
| blank / whitespace | Mint once during **preview**: `it_` / `sec_` / `dim_` / `bnd_` + 12 hex. Stored preview document has final ids. Commit does not mint again. |
| populated | Trim. Unique within that entity collection. Duplicates → hard reject every collision. Charset `^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$`. Must not start with `afenda-`. |
| populated + create | Kept. |
| populated + xlsx/JSON update | Must exist on `_Source.document` (same entity type). Immutable. Unknown id → hard reject (“new rows leave id blank”). |
| populated + CSV item upsert | Must exist on **target draft**, or blank id to insert. |

**Deletion**

| Format | Missing ids vs base |
|---|---|
| xlsx / JSON | Deletions in the merged draft (items, sections, dimensions, bands as applicable). |
| CSV | **Never deletes** any entity. Item upsert only. |

### 6.2 What import may mutate

Never mutates `AssessmentVersion.document`. Commit writes the stored preview document to a new or existing TEMPLATE/ORGANISATION `draftDocument` only.

### 6.3 `order` columns (items, and the same rule for section/dimension `order`)

Hostile “required unique integer, duplicate = error” is forbidden.

For `Items.order` within each `sectionId`:

1. Parse as a number if present (floats allowed).
2. Blank / non-numeric → sort **last** (xlsx/JSON).
3. Sort ascending; **tie-break by original sheet row index** (stable, only used when values collide).
4. After sort, **renumber canonically to `1..n`** in the merged document and in `importable` used for `H_now`.

**Also canonicalize `order` (items per section, plus section/dimension order) on every draft write** — Builder autosave / PATCH `draftDocument`, new-draft-from-published, import commit, seed helpers. Otherwise a Builder document with 10/20/30 spacing produces a full-item `order` diff on a no-op Excel round-trip and weakens the property test.

Duplicates are not errors. A sheet sorted by dimension for review keeps distinct `order` values, so row index is never consulted and candidate order is unchanged.

**CSV:** blank `order` means **keep existing order** if the item id already exists; if the id is new (blank id insert), **append** after the current max in that section, then the commit document is canonicalized to `1..n` for that section’s full item list (untouched items keep relative order). A filtered CSV subset with orders `1,2,3` must not collide with the live section’s `1..20` as a hard issue.

Section and dimension `order` use the same any-number → sort → canonical `1..n` rule (tie-break sheet row; blank last).

### 6.4 Responses and new versions

- Breaking item/scoring/rule-reference changes → publish will create a new version; old responses stay put.
- Order-only (canonical `order` / rebuilt `itemIds`) → exempt from breaking warning.
- No in-place mutation of a version that has responses.

---

## 7. Bands — unit, reachable set, Builder parity

### 7.1 Unit (locked)

Global bands on scaled 0–100. `Math.round(((raw − n) / (4n)) × 100)` — JS half-up for positives. Header text unchanged from revision 2 (includes `Math.round` and `4n+1`). No `dimensionId`. `scoringMode: none` → empty bands and dimensions. Mean helper columns export-only.

### 7.2 `n = 0`

Hard issue. Never call `scaleDimensionRaw` with `n = 0`. Already required to publish; import uses the same check.

### 7.3 Unreachable bands

For each band × each dimension with `n ≥ 1`, if `[minScaled, maxScaled]` contains no achievable scaled value → issue via **shared invariants** (§7.4), same as publish.

### 7.4 Import must not be stricter than Builder

`assertInstrumentInvariants(doc, mode)` where `mode` is `'draft' | 'publish'`.

Import preview maps `_Source.sourceMode`: `draft` → `assertInstrumentInvariants(merged, 'draft')`; `strict` → `'publish'`. Then it adds **import-pipeline-only** issues (ContextRules drift, scientific-notation id cells, destination mismatch is a refuse, stale_base). Those pipeline issues have no Builder equivalent and do not break parity.

| Check | `draft` (Builder autosave / draft import) | `publish` (validate + publish / strict import) |
|---|---|---|
| Draft vs strict Zod schema | `parseDraftDocument` | `parseInstrumentDocument` |
| Duplicate entity ids | **hard** | **hard** |
| Entity id charset / leading `afenda-` | **hard** | **hard** |
| Dimension with `n = 0` scored items | skip | **hard** |
| Unreachable band for a dimension | skip | **hard** |
| Integrity: dangling sectionId / dimensionId / rule item refs | skip | **hard** |
| Integrity: every item (incl. info) in exactly one `section.itemIds` | skip | **hard** |
| `scoringMode: none` vs non-empty dimensions/bands / scored items | skip (draft may be mid-edit) | **hard** (existing schema) |
| Scientific-notation id cell | n/a (JSON) | n/a (JSON); **hard on xlsx/csv import only** |
| ContextRules sheet drift | n/a | n/a; **hard on xlsx import only if sheet present and differs; absent sheet = untouched** |

Publish/Builder validate must call the **publish** column. Draft PATCH calls the **draft** column (plus order canonicalization). Do not put publish-only checks on draft save.

**Before wiring import UI**, run a read-only script `scripts/audit-import-invariants.ts` over:

- seeded SYSTEM documents (Core, Pre-joining)
- every `Assessment.draftDocument` and every `AssessmentVersion.document` in the dev database

Inspect failures. Seeded SYSTEM **must** pass. If live org drafts fail a brand-new check, either (a) add the check to publish only after those drafts are fixed, or (b) keep it warning-level until they do — do **not** ship an import gate the Builder still allows authors to create.

**Property test (fixtures, CI):** for every checked-in document (Core, Pre-joining, blank draft fixture), `export → import preview` (create-as-org or round-trip) yields **zero hard issues** and a non-breaking diff (empty or copy/meta/order only).

---

## 8. Diff is infrastructure (build first)

Diff base = **current target draft**.

```ts
type InstrumentDiff = {
  summary: {
    breaking: boolean;
    orderOnly: boolean;
    unreachableBands: boolean;
    itemCountChanged: boolean;
    staleBase: boolean;
    invisibleFieldRevert: boolean;
    contextRulesSheetDrift: boolean;
  };
  entries: /* unchanged shape */;
};
```

Build order:

1. Shared invariants + audit script + fixture property test (§7.4).
2. Diff + tests.
3. Provenance + issues.
4. Identity (all four entity types) + order canonicalization + reserved keys.
5. Chunked `_Source` (`B1..Bn`), `sourceMode`, missing `_Source` refuse, destination mismatch.
6. Normalized ContextRules hard issues (not parse refuse) + sheet protection.
7. Preview/commit API (stored document; 409 does not consume; delete on success; expiry sweep).
8. Assessments UI.
9. Version compare UI.
10. Docs mirror CI (may slip).

### 8.1 Preview storage, tenancy, lifecycle

```ts
type ImportPreview = {
  id: string;
  actorUserId: string;
  expiresAt: Date; // 30 minutes
  consumedAt: Date | null;
  targetAssessmentId: string | null;
  targetKind: "TEMPLATE" | "ORGANISATION";
  format: "xlsx" | "json" | "csv";
  uploadSha256: string;
  uploadByteLength: number;
  baseDraftRevision: number | null;
  basePublishedVersionNumber: number | null;
  document: unknown; // final minted + canonicalized document
  diff: InstrumentDiff;
  issues: ImportIssue[]; // full list — required to re-render UI after 409
  issueCount: number;
  committable: boolean; // false if any hard issue or stale_base
};
```

At **preview and commit**:

- `requireAdmin()`.
- If `targetAssessmentId` set: row must exist; `kind !== SYSTEM` and `isSystem === false`; commit uses the **stored** target id only (client cannot retarget).
- Single workspace: no separate org column.

Commit steps:

1. Load preview by id; 404/410 if missing or expired.
2. Verify `actorUserId` matches.
3. If already consumed / missing after success-delete → 409 already consumed.
4. Re-check stale base against live target; if stale → **409 `stale_base`**. Do not delete the row (UI reloads stored `issues`).
5. If `preview.committable === false` **or** `issueCount > 0` → **409 `not_committable`**. Do not write. Do not delete. Test: POST commit against a preview with ContextRules drift or integrity failures.
6. Write `preview.document` to the draft **without re-parsing the upload** and without minting ids again. On create, `allocateAssessmentKey(targetKind)` — ignore any key in the payload.
7. Increment `draftRevision`; **delete** the preview row.

Lifecycle:

- Successful commit: persist draft, then **delete** the preview row (do not leave full instrument bodies around).
- `409 stale_base` / `409 not_committable` / auth failure: **do not** delete or consume.
- Sweep `expiresAt < now()` at the start of preview/commit handlers.

---

## 9. HR-readable issues

Unchanged: provenance → `Items!F14`; no Zod jargon.

---

## 10. SYSTEM protection and keys

Normalise assessment keys: `trim` → NFKC → `toLowerCase()`. Reserved prefix `afenda-`. `kindFlags(kind)` derives `isSystem`. Import kind ∈ { TEMPLATE, ORGANISATION } only.

**Create path:** allocate a new key with the existing allocator — `org-` / `tpl-` + hex (`newOrganisationKey` / `allocateAssessmentKey`). **Any `key` in the uploaded payload or `_Source.document` is ignored** on create. Downloading Core as an example and importing as a new organisation assessment must not trip the `afenda-` reserved check on the source document’s key (SYSTEM examples have no `key` field on the instrument document itself; do not invent one from the assessment row key into the JSON body either — if export stamps a diagnostic key in Meta display-only, it stays display-only).

**Update path:** target row’s key is unchanged. Payload keys are ignored.

---

## 11. CSV

- UTF-8 with BOM.
- Header includes `order` (optional per row).
- Update only (`assessmentId` required).
- Upsert only; never deletes.
- Blank `order`: keep existing / append (§6.3).
- Invisible fields from **current target draft**.
- Cannot create sections/dimensions/consent/bands/rules.

---

## 12. Concurrency

`draftRevision` increments on every draft write including builder autosave. Stale checked at preview and commit. `409` does not consume or delete the preview.

---

## 13. Audit

Unchanged actions and meta rules (no filename).

---

## 14. Docs mirror (CI only)

Unchanged; may slip.

---

## 15. Admin UI

- Preview: stale banner, ContextRules drift issues (named rules), unreachable bands, integrity, sheet refs.
- CSV copy: upsert, no delete; blank order keeps/appends.
- `ContextRules` labelled read-only; sheet protected in the downloaded xlsx.

---

## 16. Testing (minimum)

| Case | Expect |
|---|---|
| Fixture property test: Core / Pre-joining / blank export→preview | zero hard issues |
| Export Core JSON/xlsx → import preview as **new org** | succeeds; new `org-…` key; not SYSTEM |
| Commit preview with hard issues | 409 `not_committable`; draft unchanged |
| Audit script on seeded docs | zero failures |
| `_Source` B1..Bn round-trip; gzip mtime 0 | **payload string** stable; parse equals document (not full xlsx bytes) |
| Absent ContextRules sheet | untouched; no drift issues |
| `sourceMode=draft` incomplete draft export | draft Zod accepts; strict would fail — importer uses A2 |
| Typo in Items | merge; rules preserved |
| Excel-mutated ContextRules (`TRUE` vs `true`) with no real edit | normalized equal; no hard issue |
| Real ContextRules cell edit | hard preview issue naming rule id; not parse refuse; commit blocked |
| Delete `_Source` | parse refuse |
| Dangling rule after item delete | hard integrity issue |
| Export A, update B | destination refuse |
| Stale rev + rule revert | preview stale + diff entry; 409 keeps preview row |
| Commit then preview row gone | deleted, not retained |
| Expired preview sweep | deleted |
| Duplicate section/item/dim/band ids | hard reject |
| Blank section id | minted `sec_` once |
| Insert Items.order `3.5` between 3 and 4 | canonical 1..n; no error |
| Duplicate Items.order `3`,`3` | tie-break row index; canonical 1..n |
| CSV subset orders 1,2,3 vs section 1..20 | upsert; no hard issue; blank order keeps |
| Sort Items by dimension, order column intact | candidate order unchanged |
| Band 40–44 at n=2 | same result as publish validate (hard if invariants say hard) |
| `!ref` huge blank range | does not trip 20k non-empty limit |
| Reserved key | reject |
| Audit no filename | `assertNoPii` |

---

## 17. Proposed D24

Instrument interchange is `InstrumentDocument` JSON. Excel/CSV are skins. xlsx carries chunked gzip+base64 `_Source` in `B1..Bn` with `sourceMode`. `ContextRules` is export-only; drift is a hard preview issue after normalized compare, not a parse refuse. Import preview-then-commit of a server-stored document; preview bodies are deleted on consume and expiry. Never overwrites SYSTEM. CSV upsert-only. Shared invariants with Builder/publish. Band cut-points global scaled 0–100. Document-scoped ids with `it_`/`sec_`/`dim_`/`bnd_` minting. Docs mirrors CI-only for SYSTEM/TEMPLATE.

---

## 18. Spec self-review

- Revision 4: shared `canonicalCell`; commit requires `committable`; create-path key allocator restored; invariant `mode` matrix; absent ContextRules = untouched; order canonicalized on every draft write; `_Source` veryHidden; preview stores `issues`; `_Source` payload stability (not full xlsx).
- `mode` is `'draft' | 'publish'` with an explicit check matrix.
- No unresolved editorial fragments.

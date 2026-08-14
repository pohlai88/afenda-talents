# Afenda Talents — Instrument download/upload round trip

**Date:** 2026-08-14
**Status:** Approved for implementation
**Parent:** `2026-08-05-instrument-template-import-design.md` (D24, revision 4)

---

## 1. Overview

An administrator downloads a template, authors an instrument offline in Excel, uploads
it, reviews a diff, and commits it as a draft. The upload half shipped on 2026-08-14
(`fa90e0d`); the download half was never built, so the round trip has no entry point.

This spec covers the missing half plus three corrections to the half that shipped. It is
a subset of D24, not a replacement: D24 remains the authority on the round-trip contract,
`_Source`, identity, bands, and issue reporting. Where this document is silent, D24 governs.

`exportWorkbook` (`instrument-template/workbook.ts`) and `exportCsv`
(`instrument-template/csv.ts`) already exist and are correct. They have **no callers**.
This is largely a plumbing exercise over library code that is already tested.

## 2. Goals

- An admin can obtain a structurally valid, dropdown-equipped workbook without knowing
  the JSON schema.
- An admin can round-trip any existing assessment: download, edit, upload back.
- Uploading can never create, update, or replace a SYSTEM assessment.
- An imported assessment carries a real key, and its kind is chosen deliberately.

## 3. Non-goals

Carried from D24 §3, plus these, which were considered and scoped out:

- `POST /assessments/[id]/convert` (TEMPLATE → ORGANISATION)
- `POST /assessments/archive-many`
- `POST /assessments/compare`
- Server-stored import previews (D24 §8.1) — see §7
- Any Prisma schema migration

## 4. Endpoints

```
GET /api/admin/assessments/template?kind=blank|core|sales&format=xlsx|json|csv
GET /api/admin/assessments/[id]/export?format=xlsx|json|csv&source=draft|published
```

Both call `requireHiringUser()`. Downloading is a read, and VIEWER can already preview any
instrument in the admin UI; gating download at ADMIN would be stricter than the surface it
mirrors. Mutations stay `requireAdmin()`.

Both respond with `Content-Disposition: attachment` and a filename derived from the
assessment title, slugified. Both audit through the existing `export.downloaded` action
with `{ assessmentId, format }` meta — **no filename**, per D24 §13.

`source=draft` on an assessment with no open draft falls back to the latest published
version, matching what the builder shows. `source=published` on an assessment with no
published version is a `409`.

### 4.1 Template downloads carry no base identity

A template download stamps `_Source` with `baseAssessmentId: null`. Only `[id]/export`
stamps a real base.

This is the one call D24 does not spell out, and it is load-bearing. `_Source` is what
tells the importer "this file is an update to assessment X". If a downloaded Core template
carried Core's assessment id, uploading it would present as an attempt to overwrite a
SYSTEM row rather than to create a new instrument — and the SYSTEM guard in §6 would
correctly refuse the very flow the template exists to enable.

Splitting the routes makes "learn from an example" and "round-trip this assessment"
structurally different operations rather than one operation whose meaning depends on the
user choosing the right option. D24 §16 requires "export Core → import as new org" to
succeed and "export A → update B" to refuse; this split is what makes both true by
construction.

## 5. Template contents

| kind | document | sourceMode |
|---|---|---|
| `blank` | `blankInstrumentDocument()` | `draft` |
| `core` | `CORE_V1_DOCUMENT` | `strict` |
| `sales` | `data/Sales_Performance_Role_Positioning_Assessment.json` | `strict` |

These come from a single registry keyed by `kind`, which is also what the Zod enum and the
dialog's options derive from — adding `prejoining` (already on main, and a useful example
because it is unscored) or any future shipped instrument is then one entry, not four edits.
The registry is the same list `tests/unit/shipped-documents.test.ts` already guards.

Sheets are whatever `exportWorkbook` already produces (D24 §5.1): `Meta`, `Consent`,
`Sections`, `Dimensions`, `Items`, `Bands`, `ContextRules` (sheet-protected, export-only),
and hidden `Lists` driving Excel data validation. The blank document ships one section and
one item as a worked row.

`sourceMode: "draft"` on the blank template is required, not cosmetic: a skeleton is
deliberately incomplete and strict parse would reject it on re-upload.

CSV is offered, and the dialog states plainly that it is **items only, updates an existing
assessment, and cannot create one**. `previewImportCsv` refuses a null target by design, so
an unlabelled CSV template would be a dead end.

## 6. Corrections to the shipped import

### 6.1 SYSTEM protection (defect)

`import/preview` and `import/commit` currently accept any `targetId`. A SYSTEM assessment
can therefore be overwritten by upload, which D24 §3 lists as an explicit non-goal and
D24 §8.1 forbids at both preview and commit.

Both handlers reject a target with `isSystem === true` or `kind === "SYSTEM"` with `409`
and a message naming the instrument as seed-owned. The check belongs in both handlers, not
only commit: preview is where the admin learns the operation is impossible, and a preview
that succeeds where commit refuses is a worse experience than refusing early.

### 6.2 Kind on create

The import dialog offers `TEMPLATE | ORGANISATION`. `SYSTEM` is not reachable through the
API. `kindFlags(kind)` derives `isSystem`, so the two can never disagree.

### 6.3 Key allocation

Imported assessments are created with `key: null` today. They get `tpl-` or `org-` plus
hex, allocated server-side. Any key present in the uploaded payload or in `_Source` is
ignored on create; on update the target row's key is unchanged (D24 §10).

`Assessment.key` is already `String? @unique`, so this needs **no migration**.

### 6.4 Module recovery

`src/lib/instrument-kind.ts` — `normalizeAssessmentKey`, `isReservedAssessmentKey`,
`kindFlags` — exists only in commit `32c3b45` and is restored here. D24 §10 refers to an
"existing allocator" (`allocateAssessmentKey` / `newOrganisationKey`) that was never on
main; it is written as part of this work, alongside the recovered module.

## 7. What stays as-is

Commit remains hash-based: the client re-sends the uploaded bytes, the server re-parses
against the target as it currently stands, and refuses unless the result still hashes to
what the preview displayed.

D24 §8.1 specifies a stored `ImportPreview` row instead, with a 30-minute expiry,
delete-on-consume, and a commit that replays the stored document without re-parsing. That
model is stricter about what reaches the database and survives a client that lies about its
bytes. It also needs a table, a sweep, and a lifecycle.

The hash model gives the same guarantee against the attack that matters here — a client
substituting a different document between preview and commit — because the server never
accepts a document from the client at all. It is weaker in one respect: a target edited
between preview and commit produces a different hash and returns `409`, where D24 would
distinguish `stale_base` from `not_committable`. That is a message-quality difference, not
a correctness one.

Revisit if preview bodies ever need to outlive a request, or if the diff UI needs to
re-render after a `409` without re-uploading.

## 8. UI

`/admin/assessments`:

- Header: **Download template** (kind + format) beside the existing **Import**, which gains
  the kind toggle from §6.2. Both ADMIN-only, matching **New assessment**.
- Row action: **Download** (format + draft/published), available to VIEWER, matching the
  existing **Preview** affordance.

The download dialogs are plain selects and a submit — no preview step, since nothing is
written. Follows `assessments-toolbar.tsx` conventions: `Dialog`, `Button`, `Alert`,
`apiErrorMessage`.

## 9. Testing

Round-trip property tests, which is where this class of feature fails:

| Case | Expect |
|---|---|
| blank → export → import preview | zero hard issues |
| Core → export → import as **new org** | succeeds; fresh `org-` key; `isSystem: false` |
| Sales → export xlsx → import preview | zero hard issues |
| export A → import into B | refuse |
| import into a SYSTEM assessment | `409`, draft unchanged |
| CSV with `targetId: null` | refuse, message names the limitation |
| `source=published` with no published version | `409` |
| `source=draft` with no draft | falls back to latest published |
| download audit row | carries no filename |

## 10. Open risk

**Export-then-import-as-new is unproven.** `merge.ts` compares `_Source`'s
`baseAssessmentId` against the supplied target through `normalizeAssessmentId`, and the
null-target-with-stamped-base path has not been exercised. §4.1 is designed to avoid it for
templates, but `[id]/export` → import-as-new legitimately hits it, and D24 §16 requires it
to work.

Prove it with a test before building the UI. If it misbehaves, the fix belongs in that
comparison, not in the routes.

## 11. Spec self-review

- No placeholders or TBDs.
- §4.1 and §6.1 interact deliberately and are cross-referenced; the SYSTEM guard would
  otherwise block the template flow.
- §7 states plainly where this departs from the approved parent spec and what is given up.
- Scope is one implementation plan: two read endpoints, three corrections to existing
  handlers, one recovered module, two dialogs.
- "Template" is used only for the standalone downloads of §5, never for
  `kind: TEMPLATE` assessments, which are always written as `TEMPLATE`.

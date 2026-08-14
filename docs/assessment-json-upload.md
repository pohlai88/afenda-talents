# Preparing assessment questions as JSON

Fill in `data/assessment-template.json`, then push it into a draft and publish it.
The template validates clean as-is (zero errors, zero warnings), so anything that
breaks after you edit it came from your edit.

Contract: `src/lib/instrument-document.ts` (strict, used at publish and before every
score) and `src/lib/instrument-draft.ts` (lenient, used for draft autosave).

## The shape

One JSON object — the **instrument document**. Questions are `items`, not a flat
question list, because scoring needs the dimensions, bands and rules alongside them.

| Key | Meaning |
| --- | --- |
| `schemaVersion` | Always `1`. |
| `title` | Candidate-facing name. Overwrites the assessment title on publish. |
| `internalDescription` | Optional. Hiring team only. |
| `candidateIntroduction` | Shown before the questions. Required. |
| `consent` | Four required strings: `purpose`, `whatWeCollect`, `whoSeesIt`, `retention`. |
| `estimatedMinutes` | Positive number. Over 45 raises a publish warning. |
| `displayMode` | `continuous` (one scroll) or `section` (one section per screen). |
| `dimensions` | What gets scored. Each needs `id`, `code`, `name`, `order`. |
| `bands` | Score labels. Must tile 0–100 with no gap or overlap. |
| `sections` | Ordering. Each item id appears in exactly one section. |
| `items` | The questions. See below. |
| `responseContextRules` | Optional honesty/effort checks. `[]` is valid. |

Write `{RETENTION_DAYS}` inside `consent.retention` — it is replaced at display time
with the configured retention period.

## Item types

**`likert`** — the scored question type. 1–5 only; `min`/`max` cannot change and
`labels` must be exactly 5 strings.

- `scored: true` → must carry a `dimensionId` matching a `dimensions[].id`.
- `scored: false` → set `dimensionId: null`. Use these for validity/check items so
  they are collected but excluded from every dimension score.
- `reverseScored: true` → the value is flipped (`6 − value`) before summing. Use it
  for negatively worded statements.

**`short_text` / `long_text`** — collected, never scored. Optional `helperText`,
optional `maxLength`.

**`info`** — a text block, not a question. Only `id` and `body`.

## Rules that block publish

Break one of these and `/validate` and `/publish` reject the document:

- Duplicate item ids, or duplicate dimension ids.
- An item that is in no section, in two sections, or twice in one section.
- A section referencing an item id that does not exist.
- A scored Likert item without a valid `dimensionId`.
- **A dimension with zero scored Likert items.** Delete the dimension or give it items.
- Bands that do not start at 0, end at 100, or that leave a gap or overlap.
- A response-context rule referencing an item id that does not exist.
- Empty `title`, `candidateIntroduction`, any `consent` field, or zero answerable items.

## Warnings (publish still succeeds)

- `estimatedMinutes` over 45.
- More than 5 required open-text items.
- More than half of Likert items reverse-scored.
- A dimension with 1 or 2 scored items — aim for 3 or more.

## Response-context rules

| `type` | Fields | Triggers when |
| --- | --- | --- |
| `social_desirability` | `itemIds`, `threshold` (default 8) | Sum of those item values ≥ threshold. |
| `consistency_pairs` | `pairs`, `threshold` (default 4) | Total absolute difference across pairs ≥ threshold. |
| `straight_line` | `runLength` (default 12) | Same answer given `runLength` times in a row. |
| `rushed_time` | `threshold` seconds (default 240) | Self-reported total time < threshold. |

All four report context only. There is no pass/fail and no overall score.

## Uploading it

There is no file-upload endpoint. The JSON goes in as the assessment's draft
document, then gets published as a version.

```bash
# 1. Create an empty draft — returns { "id": "..." }
curl -X POST http://localhost:3000/api/admin/assessments \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"title":"My assessment"}'

# 2. Read the current draftRevision (optimistic-concurrency guard)
curl http://localhost:3000/api/admin/assessments/$ID -b cookies.txt

# 3. Push the document. expectedRevision must equal the current draftRevision.
jq --argjson rev "$REV" \
   '{draftDocument: ., expectedRevision: $rev}' data/assessment-template.json \
  | curl -X PATCH http://localhost:3000/api/admin/assessments/$ID \
      -H 'Content-Type: application/json' -b cookies.txt --data-binary @-

# 4. Dry run — returns { ok, issues[] } without publishing
curl -X POST http://localhost:3000/api/admin/assessments/$ID/validate -b cookies.txt

# 5. Publish version N
curl -X POST http://localhost:3000/api/admin/assessments/$ID/publish -b cookies.txt
```

All five require an ADMIN session cookie. A `409` on step 3 means the draft moved
underneath you — re-read `draftRevision` and retry.

Published versions are immutable. To change questions, `POST .../new-draft`, edit,
and publish again; existing rounds stay pinned to the version they were opened on.

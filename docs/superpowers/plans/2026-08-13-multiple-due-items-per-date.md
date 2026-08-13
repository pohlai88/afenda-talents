# Multiple Due Items Per Line Per Date — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one obligation line hold more than one due item on the same date, distinguished by period label, without allowing accidental duplicates.

**Architecture:** Widen the `ObligationDueItem` unique key from `(lineId, dueDate)` to `(lineId, dueDate, periodLabel)`. Because the label auto-fills from the due date, a resubmit still collides while a deliberate second item does not. Two pure helpers carry the label logic so they are unit-testable without a database; the add-due-item form pre-empts the collision by suggesting a free label.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 + PostgreSQL (Neon), Zod 4, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-13-multiple-due-items-per-date-design.md`

## Global Constraints

- `periodLabel` is capped at 80 characters by `createDueItemSchema` in `src/lib/corporate-admin/domain.ts:272`. Never produce a longer value.
- Files under `src/lib/corporate-admin/` that are imported by unit tests must not import Prisma. Keep helpers pure.
- Zod-validate every API body (repo rule, `AGENTS.md`).
- Corporate Administration does not become accounting. No invoice matching, allocation, or ledger posting (D19 boundary).
- Run `pnpm lint && pnpm typecheck && pnpm test` before declaring any task done, and paste the output. A phase is not done because it looks done (`AGENTS.md`).
- Unit tests run with `environment: "node"` and only match `tests/unit/**/*.test.ts`. There is no React component-test harness in this repo — do not write one.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/corporate-admin/obligation-lines.ts` | Add `suggestPeriodLabel` and `duplicateDueItemMessage`. Pure, no Prisma. | 1 |
| `tests/unit/corporate-period-label.test.ts` | Tests for both helpers. | 1 |
| `prisma/schema.prisma` | Widen the `ObligationDueItem` unique key. | 2 |
| `prisma/migrations/20260813070000_allow_multiple_due_items_per_date/migration.sql` | Drop the old unique index, create the new one. | 2 |
| `DECISIONS.md` | Record why the key widened. | 2 |
| `src/app/api/admin/corporate/obligations/[id]/due-items/route.ts` | Use the label-aware duplicate message. | 3 |
| `src/app/admin/(shell)/corporate/obligations/[id]/lines/page.tsx` | Load every due item's `(lineId, dueDate, periodLabel)`. | 4 |
| `src/components/corporate/obligation-line-manager.tsx` | Show existing same-date items; pre-fill a free label. | 4 |
| `docs/ui/CA_03_OBLIGATION_LINES.md` | Note that a line may hold several due items on one date. | 4 |

---

### Task 1: Period-label helpers

Both helpers are pure and live in the same module, so they share one test cycle.

**Files:**
- Modify: `src/lib/corporate-admin/obligation-lines.ts`
- Test: `tests/unit/corporate-period-label.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `suggestPeriodLabel(base: string, taken: string[]): string`
  - `duplicateDueItemMessage(periodLabel: string): string`
  - `PERIOD_LABEL_MAX_LENGTH: number` (value `80`)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/corporate-period-label.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  duplicateDueItemMessage,
  PERIOD_LABEL_MAX_LENGTH,
  suggestPeriodLabel,
} from "@/lib/corporate-admin/obligation-lines";

describe("suggestPeriodLabel", () => {
  it("returns the base label when nothing is taken", () => {
    expect(suggestPeriodLabel("Feb 2026", [])).toBe("Feb 2026");
  });

  it("appends a counter when the base is taken", () => {
    expect(suggestPeriodLabel("Feb 2026", ["Feb 2026"])).toBe("Feb 2026 · 2");
  });

  it("keeps counting past consecutive taken labels", () => {
    expect(suggestPeriodLabel("Feb 2026", ["Feb 2026", "Feb 2026 · 2"])).toBe("Feb 2026 · 3");
  });

  it("fills a gap in the sequence", () => {
    expect(suggestPeriodLabel("Feb 2026", ["Feb 2026", "Feb 2026 · 3"])).toBe("Feb 2026 · 2");
  });

  it("ignores surrounding whitespace on both sides", () => {
    expect(suggestPeriodLabel("  Feb 2026  ", [" Feb 2026 "])).toBe("Feb 2026 · 2");
  });

  it("truncates rather than exceeding the period label cap", () => {
    const base = "A".repeat(PERIOD_LABEL_MAX_LENGTH);
    const result = suggestPeriodLabel(base, [base]);
    expect(result.length).toBeLessThanOrEqual(PERIOD_LABEL_MAX_LENGTH);
    expect(result.endsWith(" · 2")).toBe(true);
  });

  it("never returns a label longer than the cap even when free", () => {
    const base = "B".repeat(PERIOD_LABEL_MAX_LENGTH + 20);
    expect(suggestPeriodLabel(base, []).length).toBe(PERIOD_LABEL_MAX_LENGTH);
  });
});

describe("duplicateDueItemMessage", () => {
  it("names the conflicting label so the user knows what to change", () => {
    expect(duplicateDueItemMessage("Feb 2026")).toBe(
      'A due item labelled "Feb 2026" already exists for that line and date. Give this one a different period label.',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/corporate-period-label.test.ts`

Expected: FAIL — the module has no export named `suggestPeriodLabel`.

- [ ] **Step 3: Implement the helpers**

Append to `src/lib/corporate-admin/obligation-lines.ts`:

```ts
/** Mirrors the cap on `periodLabel` in `createDueItemSchema`. */
export const PERIOD_LABEL_MAX_LENGTH = 80;

/**
 * A line may hold several due items on one date, so the period label is what tells
 * them apart — and what the unique key uses. Given the labels already taken for that
 * line and date, return a free one, never exceeding the schema's cap.
 */
export function suggestPeriodLabel(base: string, taken: string[]): string {
  const trimmed = base.trim();
  const used = new Set(taken.map((label) => label.trim()));
  if (!used.has(trimmed)) return trimmed.slice(0, PERIOD_LABEL_MAX_LENGTH);

  for (let counter = 2; counter <= used.size + 2; counter += 1) {
    const suffix = ` · ${counter}`;
    const candidate = `${trimmed.slice(0, PERIOD_LABEL_MAX_LENGTH - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return trimmed.slice(0, PERIOD_LABEL_MAX_LENGTH);
}

export function duplicateDueItemMessage(periodLabel: string): string {
  return `A due item labelled "${periodLabel}" already exists for that line and date. Give this one a different period label.`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/corporate-period-label.test.ts`

Expected: PASS, 8 tests.

- [ ] **Step 5: Run lint and typecheck**

Run: `pnpm lint && pnpm typecheck`

Expected: both exit 0 with no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/corporate-admin/obligation-lines.ts tests/unit/corporate-period-label.test.ts
git commit -m "Add period label suggestion and duplicate message helpers"
```

---

### Task 2: Widen the due item unique key

**Files:**
- Modify: `prisma/schema.prisma` (model `ObligationDueItem`, the `@@unique` line)
- Create: `prisma/migrations/20260813070000_allow_multiple_due_items_per_date/migration.sql`
- Modify: `DECISIONS.md`
- Test: `tests/unit/corporate-due-item-uniqueness.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: the Prisma composite unique input renames from `lineId_dueDate` to `lineId_dueDate_periodLabel`. No hand-written code uses either name — verified before planning — so nothing else must change.

- [ ] **Step 1: Write the failing test**

This guards the constraint against being silently narrowed again. Create `tests/unit/corporate-due-item-uniqueness.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A line may legitimately hold two due items on one date (a split invoice, a partial
 * billing plus a top-up). The period label is what distinguishes them, so it must stay
 * part of the unique key — otherwise the second item is rejected again.
 */
describe("ObligationDueItem uniqueness", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  const model = schema.slice(
    schema.indexOf("model ObligationDueItem"),
    schema.indexOf("model AdministrativePayment"),
  );

  it("keys due items by line, date and period label", () => {
    expect(model).toContain("@@unique([lineId, dueDate, periodLabel])");
  });

  it("no longer keys them by line and date alone", () => {
    expect(model).not.toContain("@@unique([lineId, dueDate])");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/corporate-due-item-uniqueness.test.ts`

Expected: FAIL — the schema still reads `@@unique([lineId, dueDate])`.

- [ ] **Step 3: Update the Prisma schema**

In `prisma/schema.prisma`, inside `model ObligationDueItem`, change exactly one line:

```
- @@unique([lineId, dueDate])
+ @@unique([lineId, dueDate, periodLabel])
```

Leave all five `@@index` lines untouched.

- [ ] **Step 4: Write the migration**

First confirm the newest existing migration directory so the new timestamp sorts last:

Run: `ls prisma/migrations`

At the time of writing the newest is `20260813060000_add_corporate_automation_runs`. If a newer one exists, pick a timestamp after it and rename the directory accordingly.

Create `prisma/migrations/20260813070000_allow_multiple_due_items_per_date/migration.sql`:

```sql
-- A line may hold several due items on one date (split invoice, partial billing plus
-- top-up). The period label distinguishes them and becomes part of the identity.
-- This strictly relaxes the previous key, so no existing row can conflict.
DROP INDEX "ObligationDueItem_lineId_dueDate_key";

CREATE UNIQUE INDEX "ObligationDueItem_lineId_dueDate_periodLabel_key"
  ON "ObligationDueItem"("lineId", "dueDate", "periodLabel");
```

- [ ] **Step 5: Regenerate the client and validate**

Run: `pnpm prisma validate && pnpm prisma generate`

Expected: "The schema at prisma/schema.prisma is valid" followed by a successful client generation.

Do **not** run `pnpm prisma migrate dev` — it requires a live database connection, and `vercel-build` runs `pnpm db:deploy` on production deploys.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/corporate-due-item-uniqueness.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 7: Record the decision**

Append to `DECISIONS.md`, following the formatting of the entries already there:

```markdown
## D20 — A due item is identified by line, date and period label

`ObligationDueItem` was unique on `(lineId, dueDate)`, which allowed only one due item
per line per date. Real administration produces more: a split invoice, a partial billing
plus a top-up, two vendors invoicing one line on one day. The key now includes
`periodLabel`.

The label was chosen as the discriminator because it is server-defaulted from the due
date, so an accidental resubmit still collides and is still rejected, while a deliberate
second item must be named — which also makes the two rows readable wherever due items are
listed. Obligation-level same-date items across different lines already worked and were
not changed.
```

- [ ] **Step 8: Run the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: lint and typecheck silent, all tests pass. Paste the output.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations DECISIONS.md tests/unit/corporate-due-item-uniqueness.test.ts src/generated
git commit -m "Key due items by line, date and period label"
```

---

### Task 3: Duplicate response names the label

**Files:**
- Modify: `src/app/api/admin/corporate/obligations/[id]/due-items/route.ts`

**Interfaces:**
- Consumes: `duplicateDueItemMessage(periodLabel: string): string` from Task 1.
- Produces: nothing new.

The existing 409 says "A due item already exists for that line and date", which no longer identifies the conflict now that the label is part of the key. The label is computed inside the transaction callback, so it must be hoisted to be visible in the `catch`.

- [ ] **Step 1: Import the helper**

Add `duplicateDueItemMessage` to the existing import from `@/lib/corporate-admin/obligation-lines`, which currently imports `createDueItemWithLineSchema`:

```ts
import { createDueItemWithLineSchema, duplicateDueItemMessage } from "@/lib/corporate-admin/obligation-lines";
```

- [ ] **Step 2: Hoist the attempted label**

Immediately before `try {` (the one wrapping `await db.$transaction`), add:

```ts
  let attemptedLabel = "";
```

- [ ] **Step 3: Assign it where the label is decided**

In the transaction callback, replace the inline `periodLabel` expression in the `create` call. Before `const created = await tx.obligationDueItem.create({`, insert:

```ts
      attemptedLabel = parsed.data.periodLabel?.trim() || defaultPeriodLabel(dueDateText);
```

and change the `create` data field from

```ts
          periodLabel: parsed.data.periodLabel?.trim() || defaultPeriodLabel(dueDateText),
```

to

```ts
          periodLabel: attemptedLabel,
```

- [ ] **Step 4: Use the helper in the catch**

In the `catch` block, change the error payload from

```ts
      { error: duplicate ? "A due item already exists for that line and date" : message },
```

to

```ts
      { error: duplicate ? duplicateDueItemMessage(attemptedLabel) : message },
```

Leave the status logic (`missing ? 404 : duplicate ? 409 : 400`) unchanged.

- [ ] **Step 5: Verify**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: all silent/passing. If typecheck reports `defaultPeriodLabel` unused or missing, confirm it is still imported from `@/lib/corporate-admin/domain` at the top of the file — it is used by the new assignment.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/admin/corporate/obligations/[id]/due-items/route.ts"
git commit -m "Name the conflicting label when a due item collides"
```

---

### Task 4: Duplicate-aware add-due-item form

**Files:**
- Modify: `src/app/admin/(shell)/corporate/obligations/[id]/lines/page.tsx`
- Modify: `src/components/corporate/obligation-line-manager.tsx`
- Modify: the CA documentation file covering obligation lines under `docs/ui/`

**Interfaces:**
- Consumes: `suggestPeriodLabel(base, taken)` from Task 1; `defaultPeriodLabel(dueDate)` from `@/lib/corporate-admin/domain`.
- Produces: `ObligationLineRow` gains `dueItems: { dueDate: string; periodLabel: string }[]`.

The page's existing `lines.include.dueItems` uses `take: 4` and feeds the summary cards. It is deliberately not widened — collision detection needs every label for a date, and inflating that nested include would over-fetch for the summaries too. A separate flat query is cheaper and clearer.

- [ ] **Step 1: Load every due item label on the page**

In `src/app/admin/(shell)/corporate/obligations/[id]/lines/page.tsx`, after the `if (!obligation) notFound();` line, add:

```ts
  const dueLabels = await db.obligationDueItem.findMany({
    where: { obligationId: id },
    select: { lineId: true, dueDate: true, periodLabel: true },
    orderBy: { dueDate: "desc" },
  });
```

- [ ] **Step 2: Attach them to each line row**

In the `const lines: ObligationLineRow[] = obligation.lines.map((line) => ({ ... }))` mapping, add one property after `dueCount: line._count.dueItems,`:

```ts
    dueItems: dueLabels
      .filter((due) => due.lineId === line.id)
      .map((due) => ({ dueDate: formatDateOnly(due.dueDate), periodLabel: due.periodLabel })),
```

- [ ] **Step 3: Widen the row type**

In `src/components/corporate/obligation-line-manager.tsx`, add one field to `ObligationLineRow`, after `dueCount: number;`:

```ts
  dueItems: { dueDate: string; periodLabel: string }[];
```

- [ ] **Step 4: Verify the wiring compiles**

Run: `pnpm typecheck`

Expected: exit 0. A failure here means a second construction site of `ObligationLineRow` exists — find it with `grep -rn "ObligationLineRow" src/` and give it the same `dueItems` field.

- [ ] **Step 5: Import the helper into the component**

Add to the imports in `src/components/corporate/obligation-line-manager.tsx`:

```ts
import { suggestPeriodLabel } from "@/lib/corporate-admin/obligation-lines";
import { defaultPeriodLabel } from "@/lib/corporate-admin/domain";
```

If `@/lib/corporate-admin/domain` is already imported in this file, add `defaultPeriodLabel` to that existing import instead of adding a second one.

- [ ] **Step 6: Derive the clash for the chosen date**

Inside the `ObligationLineManager` component body, after the existing `useState` declarations, add:

```ts
  const clashingLabels = manualLine && manualDueDate
    ? manualLine.dueItems.filter((due) => due.dueDate === manualDueDate).map((due) => due.periodLabel)
    : [];
```

- [ ] **Step 7: Suggest a free label when the date changes**

`src/components/corporate/obligation-line-manager.tsx:324` currently reads:

```tsx
        <AfendaField label="Due date" id="line-manual-due" required><Input id="line-manual-due" type="date" value={manualDueDate} onChange={(event) => setManualDueDate(event.target.value)} /></AfendaField>
```

Replace that `onChange` handler with:

```tsx
onChange={(event) => {
  const nextDate = event.target.value;
  setManualDueDate(nextDate);
  const taken = manualLine
    ? manualLine.dueItems.filter((due) => due.dueDate === nextDate).map((due) => due.periodLabel)
    : [];
  setManualPeriod(taken.length === 0 ? "" : suggestPeriodLabel(defaultPeriodLabel(nextDate), taken));
}}
```

Leaving the field empty when nothing clashes preserves today's behaviour, where the server fills in the default.

- [ ] **Step 8: Show what already exists, and offer the other model**

Insert directly above the period-label field at `src/components/corporate/obligation-line-manager.tsx:325`:

```tsx
        {clashingLabels.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {clashingLabels.length} already on this date: {clashingLabels.join(", ")}. Keep the suggested period label to add a second item to this line, or cancel and add a separate agreement line if this is a different charge.
          </p>
        ) : null}
```

The second clause is what serves the "both happen in practice" case from the spec: some same-date pairs belong on one line, others are genuinely separate lines, and this is the moment the user decides. The overlay title already names the target line (`Add manual due · <line name>`), so the line being written to is explicit without further change.

- [ ] **Step 9: Verify the whole gate**

Run: `pnpm lint && pnpm typecheck && pnpm test && VERCEL_ENV=preview pnpm build`

Expected: all pass, build exits 0. Paste the output.

- [ ] **Step 10: Verify by hand**

There is no component-test harness in this repo, so confirm behaviour in the running app:

```bash
pnpm dev
```

1. Open an ACTIVE obligation, go to **Agreement lines**
2. Add a manual due item on a line for a date that has none — the label field stays empty, and it saves
3. Add another on the **same line and same date** — the form now lists the existing label and pre-fills `<label> · 2`
4. Accept the suggestion and save — it succeeds, where before it returned a 409
5. Try to save with the label edited back to the existing one — the server returns the message from Task 3

- [ ] **Step 11: Update the CA documentation**

In `docs/ui/CA_03_OBLIGATION_LINES.md`, add under the due-item section:

```markdown
A line may hold several due items on the same date — a split invoice, or a partial
billing plus a top-up. They are distinguished by period label, which is part of the
due item's unique key. The add-due-item form lists any existing items for the chosen
date and suggests a free label.
```

- [ ] **Step 12: Commit**

```bash
git add "src/app/admin/(shell)/corporate/obligations/[id]/lines/page.tsx" src/components/corporate/obligation-line-manager.tsx docs/ui
git commit -m "Suggest a free period label when a due date already has items"
```

---

## Done when

- A line accepts two due items on one date with different period labels
- A repeated submit with the same label still returns 409, naming the label
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass
- The migration is committed and will apply via `pnpm db:deploy` on the next production deploy

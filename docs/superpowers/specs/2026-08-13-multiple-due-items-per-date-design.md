# Multiple Due Items Per Line Per Date — Design

Status: accepted
Date: 2026-08-13
Domain: Corporate Administration (D19)

## Purpose

An obligation line can currently hold only one due item per date. Real
administration produces more than one: a split invoice, a partial billing plus a
top-up, or two vendors invoicing against the same line on the same day. Today the
second attempt fails with a 409 and the work cannot be recorded.

This design relaxes that limit while keeping accidental duplicates out of the
database.

## What already works, and is not changed

An **obligation** can already carry several due items on one date, provided they
sit on different lines. Rent and service charge both due on the 1st is supported
today and needs no change.

The restriction is per **line**. Only same-line multiplicity is in scope.

## Boundary

Corporate Administration does not become accounts payable. This change records
that two amounts are owed on one date; it does not introduce invoice matching,
allocation, or ledger posting. See the D19 boundary in
`2026-08-12-corporate-administration-design.md`.

## Data model

`ObligationDueItem`:

```
- @@unique([lineId, dueDate])
+ @@unique([lineId, dueDate, periodLabel])
```

`periodLabel` becomes part of the row's identity. It is already non-null and
server-defaulted from the due date, so no column or nullability change is needed.

The five existing indexes are unchanged.

### Migration safety

The new key is strictly weaker than the old one: every existing row is already
unique on `(lineId, dueDate)`, so no row can violate the wider key. The migration
drops `ObligationDueItem_lineId_dueDate_key` and creates
`ObligationDueItem_lineId_dueDate_periodLabel_key`. No backfill, no data loss, no
coordinated release — code written against the narrower assumption still inserts
successfully.

No hand-written code references the generated `lineId_dueDate` composite key; it
appears only in generated Prisma client code and the original migration SQL.

## Duplicate protection

Removing the constraint outright would let a double-clicked "Add due item" create
two identical rows, because `periodLabel` auto-fills from the due date and the two
would be indistinguishable in every list.

Keeping `periodLabel` in the key preserves that protection:

- an accidental resubmit carries the same default label, still collides, still 409s
- a deliberate second item carries a different label, and is therefore also
  readable as a distinct row wherever due items are listed

The label is the thing that makes the row meaningful to a human, so making it the
discriminator costs nothing extra.

## Server contract

`src/app/api/admin/corporate/obligations/[id]/due-items/route.ts` keeps its
transaction, `FOR UPDATE` row locks, and recurrence advance unchanged. Only the
duplicate branch changes, because the old message no longer identifies the
conflict:

> A due item labelled "Feb 2026" already exists for that line and date. Give this
> one a different period label.

A pure helper is added to `src/lib/corporate-admin/obligation-lines.ts`:

```ts
suggestPeriodLabel(base: string, taken: string[]): string
```

It returns `base` when free, otherwise `base · 2`, `base · 3`, and so on, skipping
labels already present. `periodLabel` is capped at 80 characters by
`createDueItemSchema`, so when appending a suffix would exceed that, the helper
truncates `base` rather than returning a value the schema will reject. It holds no
Prisma import so it is unit-testable without a database, matching the repository
convention that `pnpm test` covers pure modules.

## UI

`src/app/admin/(shell)/corporate/obligations/[id]/lines/page.tsx` is a server
component that already queries the obligation's lines. It extends that query to
include each line's due items, projecting only `dueDate` and `periodLabel`, and
passes them to `ObligationLineManager`. No new API endpoint is required.

In the add-due-item form inside
`src/components/corporate/obligation-line-manager.tsx`:

- when the chosen date already has items on that line, they are listed inline
  ("1 existing: Feb 2026") so the user sees what they are about to duplicate
- the period label is pre-filled with `suggestPeriodLabel(...)` and remains editable
- the target line is shown explicitly, with an inline affordance to create a new
  line instead — because some same-date pairs are genuinely separate lines, and the
  user should be able to choose the right model at the point of decision

The form prevents the common collision; the server remains authoritative and still
returns 409 on a race.

## Testing

Unit tests, no database required:

- two due items on one line and date with different period labels both validate
- identical labels are rejected
- `suggestPeriodLabel` with no labels taken, one taken, and a gap in the sequence
- `suggestPeriodLabel` truncates rather than exceeding the 80-character cap
- a schema assertion that the `ObligationDueItem` unique key contains
  `periodLabel`, so a later edit cannot silently narrow it back

## Deployment

`vercel-build` runs `pnpm db:deploy` when `VERCEL_ENV` is `production`, so the
migration applies automatically on merge to `main`. Because the change is
backward-compatible, no downtime or release coordination is needed.

## Out of scope

- Obligation-level same-date items across different lines: already supported
- Invoice matching, allocation, or any accounting behaviour: excluded by D19
- Broader Corporate UI rework with shadcn Studio: separate project
- Editability gaps for sites, contacts, obligation parties, obligation-site links
  and service coverage: separate project

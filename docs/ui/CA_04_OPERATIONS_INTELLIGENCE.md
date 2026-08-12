# CA-04 — Corporate Operations Intelligence

## Purpose

CA-04 turns the Corporate Administration relationship graph into an operator console. The goal is not another dashboard; it is to reduce manual cross-sheet searching, filtering and reconciliation work while preserving the data integrity and workflow advantages that spreadsheets do not provide.

## Operating surface

`/admin/corporate/operations`

The console presents one Corporate graph through three synchronized perspectives:

1. **Calendar** — chronological operational agenda.
2. **Coverage matrix** — Site × service-category provider coverage.
3. **Operations grid** — spreadsheet-speed scanning across obligations and agreement lines.

The default is Calendar because the first operator question is normally “what needs attention next?” rather than “what charts do I have?”.

## Global Corporate search

`Cmd+K` / `Ctrl+K` opens Corporate search from anywhere inside Corporate Administration.

Searchable record types:

- Site;
- Counterparty;
- Obligation;
- Agreement Line;
- Due Item / invoice reference.

Search is read-only navigation. It does not mutate records or infer permissions beyond the existing authenticated Corporate workspace boundary.

## Calendar

The administrative agenda combines facts that were previously distributed across separate record types:

- open Due Items;
- next Agreement Line recurrence dates;
- obligation renewal dates;
- obligation end dates.

Overdue and due-soon presentation is derived at read time. No duplicate calendar status is stored.

## Coverage matrix

Rows are active Sites. Columns are service categories actually present in active Service Coverage relationships. Cells show the Counterparties currently recorded for that Site/category pair.

An empty cell means **no active relationship is recorded**. It is a review gap, not automatically a policy violation. Afenda does not invent which services every Site must have.

## Operations grid

The grid is deliberately line-centric because Agreement Lines are now the payable/scheduled operational unit beneath an obligation.

Visible context includes:

- agreement identity/status;
- Agreement Line identity/type;
- linked Sites;
- primary Counterparty;
- next due date;
- expected line amount/currency;
- open and overdue due counts.

The grid provides search, lifecycle filtering and an Attention-only mode. It links back to authoritative record workspaces rather than introducing a parallel editing model in v1.

## Saved views v1

Users can save Operations Grid search/filter state on the current device.

This is intentionally local preference storage rather than a database table. Team-shared views, ownership, permissions and synchronization are deferred until actual usage proves they are needed.

## Deterministic operator-attention rules

CA-04 introduces explicit review rules. They are not AI-generated scores and they do not mutate workflow state.

Current signals:

1. active Site with no active Service Coverage → **Review**;
2. active recurring Agreement Line with no next due date → **Action**;
3. active Agreement Line with overdue open Due Items → **Action**.

Every signal links to the authoritative record that can resolve it.

## Boundaries

CA-04 does **not** add:

- a new database schema or migration;
- bulk editing;
- drag/drop calendar rescheduling;
- automatic service-policy requirements;
- server-shared saved views;
- cross-currency aggregation;
- AI-generated risk scoring;
- payment allocation changes.

Those are separate decisions and should not be smuggled into an operator-UX phase.

## Product principle

> Excel is fast at rows. Afenda should keep that speed while adding relationships, evidence, workflow, auditability and proactive review signals that rows alone cannot understand.

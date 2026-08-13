# CA-05 — Spreadsheet-Speed Operations

## Purpose

CA-05 adds a dedicated high-density editing workspace for Corporate Administration. The goal is not to imitate a spreadsheet visually. The goal is to preserve spreadsheet speed while retaining the controls spreadsheets cannot enforce: permissions, validation, relationships, workflow semantics and auditability.

## Workspace boundary

- **Operations Console (CA-04)** is the review/analysis surface: calendar, coverage matrix, read-oriented grid and deterministic attention signals.
- **Spreadsheet Workspace (CA-05)** is the high-density mutation surface: filter, select, edit and bounded bulk actions.

Route: `/admin/corporate/operations/spreadsheet`.

## Implemented capabilities

### Fast filtering

- search Agreement, Agreement Line, Site and Counterparty text;
- filter by obligation lifecycle;
- Attention-only mode for overdue, missing-next-due or inactive lines;
- select all currently visible rows.

### Inline editing

Administrators can edit these high-frequency Agreement Line fields directly in the grid:

- Expected Amount;
- Next Due Date.

Each edit uses the existing Agreement Line PATCH API. It therefore inherits the same Zod validation, authorization and per-line audit event used by the normal record workspace.

Keyboard behavior:

- Enter commits through the control's blur/save path;
- Escape cancels the current inline editor.

### Multi-row selection

Rows can be selected individually or all currently visible rows can be selected. Bulk operations are limited to 200 identifiers per request to prevent unbounded spreadsheet-style writes.

### Bounded bulk actions

Current actions:

1. **Activate selected Agreement Lines**;
2. **Deactivate selected Agreement Lines**;
3. **Link selected Agreements to one active Site** with an optional scope role.

Bulk writes run in one database transaction. Missing records reject the whole request rather than silently producing partial results.

The `GENERAL` compatibility line cannot be deactivated. If it is included in a bulk deactivation selection, the whole action is rejected.

Bulk Site linking reuses the existing obligation↔site upsert semantics and refuses inactive Sites.

Each affected record emits the same existing audit action used by its single-record equivalent.

### Excel / Google Sheets interoperability

Selected rows can be copied as tab-separated data with headers for direct paste into Excel or Google Sheets.

This is intentionally export/copy only. CA-05 does not accept pasted tabular data as automatic mutations.

### Column visibility

Operators can show/hide secondary grid columns. This is a device-local preference and is hydrated after mount to avoid server/client rendering drift.

## Deliberately deferred

### Paste-to-mutate

Not implemented in CA-05 v1. A safe version requires a staged flow:

`paste → parse → map columns → validate every row → preview diff → explicit commit → transactional/audited write`

Direct paste-to-write would recreate one of the major spreadsheet failure modes CA-05 is intended to eliminate.

### Generic bulk field editor

Not implemented. Only high-value, well-defined operations are exposed. A generic arbitrary-field batch editor would bypass domain-specific explanations and could create large accidental changes.

### Shared column layouts / saved spreadsheet views

Device-local preferences remain sufficient for v1. Shared/team persistence should be introduced only when collaboration requirements justify ownership, sharing and permission semantics.

## Product principle

> Spreadsheet speed is valuable. Spreadsheet ambiguity is not.

CA-05 keeps fast scanning, direct editing, multi-selection and copy/paste interoperability while ensuring that writes remain attributable, validated and relationally correct.

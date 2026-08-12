# CA-06 — Safe Paste & Import

## Purpose

CA-06 gives Corporate Administration the mass-entry speed users expect from Excel and Google Sheets without allowing pasted data to bypass Afenda's validation, relationships, permissions or audit trail.

Canonical flow:

`Paste → Parse → Resolve → Preview diff → Explicit commit`

Nothing pasted is written during parsing or preview.

## Import grain

CA-06 v1 imports **Agreement Lines** because Agreement Line is the operational row grain established by CA-03 and CA-05.

Stable identifiers:

- `obligation_code` identifies the agreement.
- `line_code` identifies the payable/scheduled component inside that agreement.

The combination determines whether a row is a CREATE or UPDATE.

## Canonical columns

- obligation_code
- line_code
- line_name
- line_type
- expected_amount
- currency
- recurring
- recurrence_interval
- recurrence_unit
- first_due_date
- next_due_date
- invoice_required
- payment_terms_days
- start_date
- end_date
- notes
- site_codes

`site_codes` accepts semicolon- or comma-separated Site codes and creates real Obligation ↔ Site relationships. It is not stored as custom-field JSON.

## Safe aliases

The parser normalizes only unambiguous spreadsheet labels, including examples such as:

- Agreement Code / Contract Code → obligation_code
- Charge Code / Component Code → line_code
- Charge Name / Component Name → line_name
- Amount → expected_amount
- Due Date / Next Due → next_due_date
- Sites / Site Code → site_codes

If two pasted headers map to the same canonical field, parsing fails. Afenda never silently picks one column.

## Blank-cell rule

For updates, blank optional cells mean **unspecified / leave the existing value unchanged**.

Blank cells do not erase existing data. Explicit clearing through mass import is intentionally deferred until it has its own visible clear-token and preview semantics.

## Parsing rules

- TSV pasted directly from Excel / Google Sheets is preferred.
- CSV is accepted for ordinary single-line records.
- unknown columns fail rather than being ignored;
- booleans accept true/false, yes/no, y/n and 1/0;
- numeric amounts may contain comma thousands separators;
- dates use YYYY-MM-DD;
- imports are capped at 200 rows per transaction.

## Preview semantics

Preview resolves current Corporate data and classifies every row as:

- CREATE
- UPDATE
- NO CHANGE
- ERROR

The preview displays field-level before → after changes and Site links.

Any ERROR blocks the entire commit. There is no "commit valid rows and skip bad rows" mode.

## Stale-preview protection

Preview produces a SHA-256 fingerprint over the resolved plan, including record identifiers, decisions, changes and validation results.

Commit re-runs the planner inside the database transaction. If the re-derived plan differs from the preview hash, the transaction is rejected and the user must preview again.

This prevents committing a reviewed plan after another user or workflow changed the underlying Corporate records.

## Commit behavior

Commit is ADMIN-only and transactional.

It may:

- create a new Agreement Line under an existing open agreement;
- update an existing Agreement Line;
- link an agreement to active Sites.

Existing line and Site validation rules remain authoritative. Closed obligations cannot receive new lines. Inactive or unknown Sites block the import.

Every created/updated line and Site relationship uses the existing Corporate audit actions through the PII-safe audit helper.

## Explicit non-goals

CA-06 v1 does not:

- create obligations from pasted rows;
- create Sites or Counterparties implicitly;
- guess unknown relationships;
- erase fields from blank cells;
- partially commit valid rows while skipping invalid rows;
- persist import staging tables;
- add a new database migration;
- change payment allocation;
- change Hiring/Talents.

## Product principle

> Bulk entry should be fast. Bulk mistakes should be difficult.

The spreadsheet remains an excellent editing surface. Afenda adds the part spreadsheets cannot reliably provide: current-record resolution, relational integrity, before/after review, stale-plan protection, transactional commit and an audit trail.

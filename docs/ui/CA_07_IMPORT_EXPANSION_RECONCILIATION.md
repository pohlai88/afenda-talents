# CA-07 — Import Expansion & Reconciliation

## Purpose

CA-07 expands Corporate Administration mass-entry beyond Agreement Lines while preserving the safety contract established in CA-06.

The canonical workflow remains:

`Choose grain → Paste/load → Parse → Resolve current data → Preview exact diff → Explicit commit → Reconciliation report`

Nothing is written during paste, parse, mapping/normalization, or preview.

## Supported import grains

### Agreement Lines

Stable key: `obligation_code + line_code`.

Supports line metadata, amount/currency, recurrence, due dates, invoice requirement, payment terms, effective dates, notes, and additive Site links.

### Sites

Stable key: `site_code`.

Supports name, type, organization, address fields, country, timezone, coordinates, active status, and notes.

### Counterparties

Stable key: `counterparty_code`.

Supports name, type, registration/tax identifiers, legacy primary contact fields, address, country, website, default currency, payment terms, active status, and notes.

Custom-field JSON is deliberately not imported by these master-data flows. Relationships remain first-class relational operations rather than opaque spreadsheet cells.

## Explicit destructive clear

Blank optional cells mean **leave the current value unchanged**.

To intentionally clear a nullable scalar field, use:

`__CLEAR__`

Clear operations are:

- allowed only on explicitly nullable scalar fields;
- shown in preview as destructive changes;
- counted separately in the preview and commit summary;
- included in the preview fingerprint;
- applied only during the final transaction;
- recorded through the existing PII-safe audit helper.

`__CLEAR__` is not accepted for stable identifiers, required name/type fields, boolean lifecycle fields, or Site relationship lists.

Relationship removal is not overloaded onto the clear token.

## File ingestion

CA-07 supports local loading of:

- `.csv`
- `.tsv`
- `.txt` spreadsheet exports

Files are limited to 2 MB and transactions remain capped at 200 rows.

Native `.xlsx` ingestion is deliberately disabled in this phase because the repository does not currently contain an approved workbook parser dependency. XLSX support should be enabled only by adding a vetted parser through the normal package-manager workflow and regenerating `pnpm-lock.yaml`; ad-hoc ZIP/XML parsing or CDN-loaded workbook code is not acceptable for production.

## Header mapping

Import parsers normalize common unambiguous spreadsheet labels to canonical Afenda fields. Multiple source columns resolving to the same canonical field are rejected instead of silently choosing one. Unknown columns are rejected instead of dropped.

This is intentionally deterministic mapping rather than fuzzy/AI inference.

## Preview and stale-plan protection

Every import preview resolves current database records and classifies rows as:

- `CREATE`
- `UPDATE`
- `NO CHANGE`
- `ERROR`

The server fingerprints the fully resolved plan using SHA-256. Commit rebuilds that plan inside the database transaction. A changed database state causes a stale-preview rejection and requires a new preview.

Any error blocks the entire transaction. Partial-success imports are not supported.

## Reconciliation

After a successful import, the operator can copy a reconciliation report as TSV for Excel / Google Sheets. The report includes row identity, decision, field, before value, after value, and whether the change was destructive.

The report is evidence of the reviewed batch; it is not a second source of truth.

## Deliberate boundaries

CA-07 does not add:

- a generic ETL framework;
- implicit creation of related Sites/Counterparties/Obligations from unresolved references;
- relationship deletion through blank cells;
- custom-field JSON import;
- import staging/history database tables;
- database migrations;
- fuzzy or AI-driven field mapping;
- native XLSX parsing without an approved dependency;
- Hiring/Talents changes.

## Product principle

> Bulk entry should feel like a spreadsheet. Bulk meaning should remain governed by Afenda.

CA-07 therefore adds import breadth and reconciliation without weakening validation, relational integrity, explicit destructive intent, stale-plan protection, auditability, or transaction atomicity.

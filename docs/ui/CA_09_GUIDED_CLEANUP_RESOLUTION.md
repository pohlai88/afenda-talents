# CA-09 — Guided Cleanup & Relationship Resolution

## Purpose

CA-09 turns deterministic CA-08 Data Quality findings into explicit operator-controlled cleanup decisions.

Canonical workflow:

`Finding → Compare candidates → Choose intended survivor/primary → Preview exact changes → Explicit commit → Re-evaluate Data Quality`

Afenda never chooses a winner automatically.

## Supported guided resolutions

### Primary Counterparty Contact

Choose one active Contact as primary. The reviewed commit demotes other primary Contact flags and promotes the selected Contact in one transaction.

### Duplicate Counterparty Contact

A confirmed non-primary duplicate Contact can be deactivated. A Contact that is currently primary cannot be deactivated until the operator first assigns another primary.

### Primary Site Service Coverage

Choose one active provider as primary for one Site + service category. The commit demotes other active primary coverage rows in the category and promotes the selected row.

### Duplicate Site Service Coverage

A confirmed non-primary active coverage row can be deactivated. Current primary coverage must be reassigned before deactivation.

### Primary Obligation Party

Choose one existing Obligation Party edge as authoritative primary. The commit:

1. demotes other primary Obligation Party edges;
2. promotes the selected edge;
3. synchronizes `AdministrativeObligation.counterpartyId` with the selected Counterparty.

This deliberately repairs primary-party graph drift and the legacy compatibility path in the same transaction.

## Preview and stale-plan protection

Every resolution is first converted into a deterministic before → after plan and SHA-256 fingerprint.

Commit re-builds that plan inside the database transaction. If the candidate records or primary state changed after preview, the hash changes and the commit is rejected as stale.

## Auditability

CA-09 reuses existing Corporate audit actions and the PII-safe audit helper. Resolution metadata records only identifiers / resolution type / source, never contact names or email addresses.

## Safety boundaries

CA-09 does **not** add:

- automatic AI winner selection;
- fuzzy duplicate matching;
- hard deletion;
- arbitrary field merging;
- relationship merge history tables;
- database migration;
- schema changes;
- generic cleanup DSL;
- silent deactivation of a current primary;
- Hiring/Talents changes.

Ordinary missing-data findings such as legal identifiers, Site context or next-due dates continue to link to their authoritative record/editor rather than being forced through the conflict resolver.

## Product principle

> Detection is only half the value. Afenda should also make the safe resolution easier than cleaning the same conflict across spreadsheet tabs.

The operator remains the decision authority; Afenda supplies comparison, integrity rules, preview, stale-state protection, transactionality and auditability.

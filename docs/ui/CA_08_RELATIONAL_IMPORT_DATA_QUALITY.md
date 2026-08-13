# CA-08 — Relational Import & Data Quality

## Purpose

CA-08 extends Corporate Administration from safe scalar/master-data import into governed relationship maintenance and deterministic data-quality review.

The operating goal is not to hide messy data. It is to make ambiguity visible before it spreads through the operating graph.

## Relational import targets

CA-08 supports four deliberate relationship grains:

1. **Counterparty Contacts**
   - natural key: `counterparty_code + email`
   - email is required for imported contact identity because name/role is not reliably unique.

2. **Service Coverage**
   - natural key: `site_code + counterparty_code + service_category + role_code`
   - competing active primary providers for the same Site + service category are conflicts.

3. **Obligation ↔ Site**
   - natural key: `obligation_code + site_code`
   - maps directly to the existing composite relationship key.

4. **Obligation ↔ Party**
   - natural key: `obligation_code + counterparty_code + role_code`
   - competing primary obligation parties are conflicts.

Every endpoint must already exist. Relational import never creates missing Sites, Counterparties, or Obligations implicitly.

## Import decisions

Every resolved relationship row is classified as:

- `CREATE`
- `UPDATE`
- `NO CHANGE`
- `CONFLICT`
- `ERROR`

`CONFLICT` is distinct from ordinary validation failure. It means Afenda found existing state for which choosing a winner would require business judgment, for example:

- multiple existing contacts with the same Counterparty + email;
- duplicate Service Coverage natural keys;
- another active primary provider for the same Site/service category;
- another primary Contact or Obligation Party.

Afenda does not choose a winner automatically.

## Blank-field safety

Relationship imports inherit the same safety principle as CA-06/07:

> Blank optional fields mean leave the current value unchanged.

Blank cells do not erase existing contact metadata, service-level information, effective dates, role metadata, scope roles, or notes during an update.

CA-08 deliberately does **not** add relationship deletion or clearing semantics. Removing a relationship is a different business action and should receive its own explicit workflow rather than being overloaded onto spreadsheet blanks.

## Preview integrity

Relational import follows:

`Paste/load → Parse → Resolve both endpoints → Detect conflicts → Preview exact diff → SHA-256 fingerprint → Explicit transaction`

Commit re-runs relationship resolution inside the database transaction. A changed plan is rejected as stale and must be previewed again.

Any `CONFLICT` or `ERROR` blocks the entire transaction. Partial-success relationship imports are not supported.

## Data Quality control centre

CA-08 adds `/admin/corporate/data-quality` as a read-oriented control centre for deterministic cleanup findings.

Current rules include:

### Sites
- active Site with no active Service Coverage — `REVIEW`;
- duplicate active Service Coverage natural key — `ACTION`;
- multiple active primary providers for one service category — `ACTION`.

### Counterparties
- active Counterparty with no active named Contact — `REVIEW`;
- neither registration number nor tax identifier recorded — `REVIEW`;
- duplicate Contact email identity — `ACTION`;
- multiple active primary Contacts — `ACTION`.

### Obligations / Agreement Lines
- active Obligation with no Site — `REVIEW`;
- legacy primary counterparty not represented by a matching primary Obligation Party edge — `ACTION`;
- multiple primary Obligation Parties — `ACTION`;
- active recurring Agreement Line with no next-due pointer — `ACTION`.

Every finding states the rule and links to the authoritative record. These are explicit checks, not AI risk inference.

## Explainable completeness

CA-08 also computes a checklist completeness ratio for each Site, Counterparty, and Obligation.

### Site checklist
- Site type;
- organization;
- city + country;
- timezone;
- active service coverage where relevant.

### Counterparty checklist
- legal identity (registration number or tax ID);
- country;
- active named contact;
- default currency;
- payment terms.

### Obligation checklist
- category + organization;
- Site context;
- exactly one primary Party;
- Agreement Lines;
- required contract evidence when applicable.

The percentage is simply `completed checks / total checks`. It is not a risk score, compliance certification, or opaque recommendation.

## Access and audit

- Relational import remains ADMIN-only.
- Data Quality is read-accessible to normal workspace users.
- Mutations reuse existing Corporate audit events and the PII-safe audit helper.
- CA-08 adds the typed `corporate.counterparty.contact.updated` audit action so imported contact updates are attributable.

## Deliberate boundaries

CA-08 does not add:

- database tables or migrations;
- fuzzy duplicate matching;
- AI entity resolution;
- automatic merge/delete of duplicate records;
- relationship deletion through import;
- implicit policy requirements from missing data;
- a generic ETL platform;
- new Hiring/Talents behavior.

## Product principle

> A relational system should not merely store relationships. It should make ambiguous, incomplete, and contradictory relationships easier to see and repair than they are in a spreadsheet.

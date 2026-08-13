# CA-02 — Site & Relationship Graph

**Status:** implemented and verified on feature branch

## Objective

Move Corporate Administration from an obligation-centric tracker toward an operating graph that understands where obligations apply and which counterparties serve each location.

## New first-class records

- `AdministrativeSite`
- `AdministrativeCounterpartyContact`
- `AdministrativeServiceCoverage`
- `AdministrativeObligationSite`
- `AdministrativeObligationParty`

`AdministrativeObligation.counterpartyId` remains the backward-compatible primary counterparty. CA-02 adds graph relationships around that field rather than removing current behavior.

## Relationship rules

- Site ↔ Counterparty is many-to-many through Service Coverage.
- Site ↔ Obligation is many-to-many through Obligation Site.
- Counterparty ↔ Obligation is many-to-many through Obligation Party.
- Counterparty → Contact is one-to-many.
- business taxonomy such as site type, service category and relationship role remains configurable text/data rather than database lifecycle enums.
- lifecycle states remain governed enums.
- custom fields are scalar metadata only; entity relationships stay in relational tables with foreign keys.

## Operator workspaces

### Site 360

Provides one location-centred workspace for:

- site identity and metadata;
- counterparties serving the location;
- service categories and effective coverage;
- linked obligations;
- operational due context.

### Counterparty 360

Provides the inverse view for:

- sites served;
- obligation roles;
- named contacts;
- active obligations and service relationships.

### Obligation Relationship Graph

The obligation record can attach multiple sites and additional counterparties without changing the existing primary-party workflow.

## Relationship intelligence

The Corporate overview now exposes active Sites and surfaces active locations that have no active service-coverage relationship recorded. This is intentionally a **review signal**, not a policy or compliance finding.

## Editability and lifecycle

Every Corporate record can be corrected after creation and stood down when it was
created in error. Deactivation is not deletion — the row stays visible as inactive so the
audit trail remains intact (D21). The counterparty on a coverage row or obligation party,
and the site on an obligation link, are identity and cannot be edited; stand the row down
and create the correct one instead.

Every Corporate record now carries Edit and Deactivate controls for admins. Deactivating
keeps the row visible, marked Inactive, with a Reactivate control — nothing disappears,
because nothing is deleted (D21). A primary contact or coverage row cannot be deactivated
until another is made primary; the server refuses it and the reason appears in the toast.

Identity fields stay fixed: the counterparty on a coverage row, the counterparty and role
code on an obligation party, and the site on an obligation link. Those are primary-key
columns. To change one, stand the row down and create the correct one.

Stood-down obligation links remain listed on the obligation so they can be reactivated,
but are excluded from data-quality findings, site and counterparty counts, and the
operations views — an inactive link is history, not current state.

## Custom fields

`SITE` is now a valid custom-field scope. Site-specific scalar metadata can therefore be configured without migrations. Relational concepts must not be stored as IDs inside JSON custom fields.

## Migration strategy

Migration `20260812232000_add_corporate_site_relationship_graph` is additive.

It backfills:

1. one `PRIMARY` `AdministrativeObligationParty` for every existing obligation;
2. useful legacy counterparty contact fields into `AdministrativeCounterpartyContact`.

No legacy fields or data are removed.

## Isolated Neon rehearsal

Migration rehearsal was performed on branch:

- `ca02-site-relationship-rehearsal`
- `br-twilight-wildflower-az4yjzc9`

Verification result:

- all five new tables created;
- existing obligations: 5;
- primary obligation-party edges: 5;
- legacy counterparties with contact details: 9;
- promoted primary contacts: 9;
- orphan obligation-party rows: 0;
- orphan obligation-site rows: 0;
- `SITE` present in custom-field scope enum.

Production was not modified during rehearsal.

## Verification

Verified code checkpoint `d6bf40b88d593f6d8186f71b348fbb3eaf011094`:

- Vercel READY;
- lint pass;
- TypeScript pass;
- Vitest **28 files / 182 tests pass**;
- repository mechanical invariants pass;
- Prisma generation pass;
- Next.js production build pass;
- Site 360, Counterparty 360 and relationship APIs/routes compile.

The final documentation/manual head is verified separately after this note.

## Deferred to later phases

CA-02 deliberately does not add:

- Assets;
- Legal Entity master;
- obligation lines/multiple schedules;
- payment allocations;
- calendar;
- command palette;
- saved views;
- Excel-class inline editing/bulk grid.

The next structural phase is **CA-03 Obligation Lines & Multi-schedule**, which moves recurrence/due generation from one schedule per obligation toward multiple governed commercial lines under one agreement.

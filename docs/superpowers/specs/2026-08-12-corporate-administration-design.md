# Corporate Administration — MVP Design

**Date:** 2026-08-12  
**Status:** Accepted for implementation  
**Decision:** D19

## Purpose

Corporate Administration is the second internal bounded context in Afenda. It gives operations teams one governed register for tenancy, recurring charges, subscriptions, insurance, fleet, maintenance, licences, service contracts and similar administrative obligations.

The MVP must be usable without routine schema tickets. Common operational fields are first-class columns; uncommon organisation-specific fields are admin-configurable typed custom fields.

## Boundary

Corporate Administration owns:

- administrative counterparties;
- obligations/contracts and their recurrence settings;
- materialised due items;
- payment request, approval, payment recording and reconciliation status;
- corporate-administration custom field definitions.

It does **not** own accounting journals, AP invoices, bank ledger, procurement, fixed assets, DMS/storage, or a general workflow engine. Those domains may later consume confirmed Corporate Administration facts.

## Data model

### AdministrativeCounterparty

Domain-local party record for landlords, vendors, insurers, financiers, utilities, professional firms, government agencies and other administrative counterparties. It is intentionally not presented as the future ERP-wide party master.

### AdministrativeObligation

The governing record. Required: organisation, category, title, counterparty, start date and currency. Optional fields cover asset reference, owner, amount, end/renewal/notice dates, contract reference/file URL and payment method.

Recurring obligations use `recurrenceInterval + recurrenceUnit` rather than a fixed frequency enum. Examples:

- monthly = `1 MONTH`;
- quarterly = `3 MONTH`;
- semi-annual = `6 MONTH`;
- annual = `1 YEAR`;
- fortnightly = `2 WEEK`.

`nextDueDate` means the next recurrence occurrence not yet materialised as a due item.

### ObligationDueItem

A historical occurrence of an obligation. `UPCOMING`, `DUE` and `OVERDUE` are derived from `dueDate`; persisted status is only `OPEN | COMPLETED | CANCELLED`. `@@unique([obligationId, dueDate])` prevents duplicate recurrence materialisation.

### AdministrativePayment

One approval/payment execution record belongs to one due item. A due item may have several payment records, supporting instalments without introducing a many-to-many payment-application model.

Amounts are explicit: requested, approved and paid. Reconciliation is represented by `reconciledAt` and `reconciledById`; there is no redundant boolean.

### AdministrativeCustomFieldDefinition

One definition table covers COUNTERPARTY, OBLIGATION, DUE_ITEM and PAYMENT scopes. Supported types: Text, Long text, Number, Date, Boolean, Select, URL, Email, Phone. Values live in a `customFields` JSON object on the owning record, keyed by stable definition key.

Unknown keys are rejected by the server. New fields are created through the admin UI, not by arbitrary JSON submission. Field definitions are deactivated rather than deleted so historical data remains interpretable.

## Lifecycle

Obligation:

`DRAFT -> ACTIVE -> ENDED`  
`DRAFT/ACTIVE -> CANCELLED`

Payment approval:

`PENDING -> APPROVED | REJECTED | CANCELLED`

Payment execution:

`NOT_PAID -> PARTIALLY_PAID | PAID -> VOIDED`

Approval, recording and reconciliation are authenticated server-side actions. Acting user IDs come from the session; clients never submit approver/reconciler identity.

## Extensibility policy

Fields that govern lifecycle, money, dates, relationships, security or reporting-critical semantics remain first-class schema columns. Organisation-specific descriptive attributes use typed custom fields.

Free-text values such as organisation, category, counterparty type and payment method are intentionally not database enums. The UI offers common suggestions but accepts new values, preventing normal vocabulary growth from becoming a migration ticket.

## UI

Corporate Administration appears as one entry in the authenticated shell with its own compact sub-navigation:

- Overview
- Obligations
- Counterparties
- Custom fields

Desktop uses tables for scan density. Mobile switches to stacked record summaries and full-width form controls. Obligation detail is the operational centre: governing terms, next due occurrence, due history and payment workflow live together.

## Security and audit

Corporate Administration reuses the existing internal User/session system through `auth-workspace.ts` aliases. VIEWER reads; ADMIN mutates for MVP. Candidate authentication remains untouched.

Every mutation is Zod validated and audited. Audit metadata stores identifiers and non-identifying operational facts only, preserving D9.

## MVP acceptance path

1. Admin creates a counterparty.
2. Admin creates an obligation with monthly/quarterly/etc recurrence.
3. Admin activates it.
4. Admin materialises the next due item.
5. Admin requests payment.
6. Admin approves the amount.
7. Admin records payment evidence/reference.
8. Admin reconciles the payment.
9. Overview/due state reflects the result.
10. Admin can add a new typed custom field without a code change and see it on subsequent records.

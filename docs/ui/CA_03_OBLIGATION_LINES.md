# CA-03 — Obligation Lines & Multi-Schedule

## Purpose

An Administrative Obligation is the agreement or continuing administrative commitment. An Administrative Obligation Line is one payable or scheduled component beneath that agreement.

Examples under one tenancy agreement:

- RENT — monthly rent;
- SERVICE_CHARGE — monthly or quarterly service charge;
- PARKING — recurring parking fee;
- DEPOSIT — one-off deposit;
- ANNUAL_FEE — annual administrative fee.

This separation allows multiple independent schedules, amounts and invoice rules without duplicating the agreement itself.

## Canonical hierarchy

```text
Obligation
  -> Obligation Line
      -> Due Item
          -> Payment Request / Approval / Settlement / Reconciliation
```

Site and counterparty relationships remain attached to the Obligation unless a future requirement genuinely needs line-specific relationship scope.

## Compatibility

Legacy obligation amount and recurrence fields remain during adoption. Each existing obligation receives a deterministic GENERAL line populated from those legacy fields. Existing due items are attached to GENERAL.

New obligations create both:

1. a PRIMARY obligation-party relationship; and
2. a GENERAL obligation line

in the same transaction.

API callers that do not supply `lineId` continue to resolve to GENERAL.

## Due generation

Recurring due generation operates on the selected line and advances only that line's recurrence pointer. GENERAL additionally synchronizes the legacy obligation-level pointer while compatibility fields remain in use.

Manual due items should be created from the Agreement Lines workspace so the operator explicitly chooses the commercial component. Manual due creation never advances recurrence.

Uniqueness is line + due date, not obligation + due date. This allows Rent, Service Charge and Parking to all fall due on the same day.

## Line lifecycle

Lines can be active or inactive. Inactive lines preserve history and cannot generate new due items. GENERAL cannot be deactivated while it remains the compatibility line.

Changing line terms affects future operational use; existing due items retain the amounts, dates and evidence already recorded on those occurrences.

## Operator workspace

`/admin/corporate/obligations/[id]/lines`

The workspace provides:

- agreement-level rollup counts;
- recent due history with explicit line attribution;
- line amount, type, recurrence and invoice rules;
- Add line;
- Edit terms;
- Generate next;
- Add manual due;
- Deactivate / Reactivate.

The goal is to make complex agreements understandable without exploding one contract into duplicate spreadsheet rows.

## Product rules

- Obligation = agreement/context.
- Line = independently payable/scheduled component.
- Due Item = one materialized occurrence of one line.
- Payment = operational settlement workflow against a due item.
- Business line types remain configurable strings, not lifecycle enums.
- Relationships are first-class relational data, never hidden in customFields.
- Do not sum amounts across currencies without an explicit conversion/reporting policy.

## Migration rehearsal

CA-03 was rehearsed after CA-02 on isolated Neon branch `br-twilight-wildflower-az4yjzc9`.

Verified on the rehearsal clone:

- 5 obligations;
- 5 GENERAL lines;
- zero orphan line references;
- zero due items without lineId;
- due-item uniqueness is enforced by lineId + dueDate.

The rehearsal clone contained no historical due items, so the backfill path is structurally installed but had no production due rows available to exercise.

Production was not modified.

# CA-13 — Settlement, Historical Payments & File Closure

## Purpose

Corporate Administration needs to support operational clean-up and migration, not only future payment requests. A file must be able to absorb historical payments, termination evidence, deposits and final adjustments, then close only after reconciliation is resolved.

## Design rules

- Keep the existing request → approval → payment flow for new payments.
- Historical payment capture is a separate path and must be visibly labelled as historical; it does not represent a new approval.
- Reuse due items for charges/schedules. Do not create a second accounting sub-ledger.
- Use reconciliation items only for exit/settlement matters that do not fit an ordinary due item cleanly: deposits, credits/refunds, cleaning, utilities, repairs, service charges, penalties/interest and other final adjustments.
- Contract termination and administrative file closure are separate events. Termination stops the operating lifecycle; closure is allowed only after settlement controls pass.
- Imports must be previewable and allow partial success so one bad legacy row does not block the entire payment-history migration.

## Historical payment capture

Support two entry modes:

1. Manual historical payment against an existing due item.
2. CSV payment-history import using business identifiers (`obligation_code`, `line_code`, `due_date`) rather than internal database IDs.

Suggested CSV columns:

- obligation_code
- line_code
- due_date
- period_label
- expected_amount
- currency
- paid_amount
- payment_date
- payment_method
- payment_reference
- payment_proof_url
- reconciled
- notes

If the due item does not exist, import may create it when the row contains enough information. Duplicate detection should use the matched due item plus payment date, amount and reference where available.

## Settlement & closure

One closure record per obligation stores:

- termination type
- notice date
- effective date
- handover/vacate date
- reason
- termination evidence URL
- closure status
- closed timestamp / actor

Reconciliation items support:

- Deposit
- Rental
- Cleaning
- Utilities
- Repair / maintenance
- Service charge
- Penalty / interest
- Credit / refund
- Other

Each reconciliation item has a direction (payable or receivable), expected and actual amounts, resolution status, evidence and notes.

## Close-file gate

`Close file` is enabled only when:

- a closure record exists with an effective date;
- there are no open due items;
- there are no pending payment approvals;
- every recorded payment is reconciled;
- every reconciliation item is either SETTLED or WAIVED; and
- the closure is not already closed.

Closing the file records the actor/time and leaves all payment, audit and reconciliation history intact.

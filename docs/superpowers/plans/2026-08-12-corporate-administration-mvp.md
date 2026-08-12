# Corporate Administration — MVP Implementation Plan

**Date:** 2026-08-12  
**Design:** `docs/superpowers/specs/2026-08-12-corporate-administration-design.md`

## CA-00 — Boundary

- Record D19.
- Keep Talents candidate auth untouched.
- Add generic internal workspace auth aliases.

## CA-01 — Database foundation

- Add AdministrativeCounterparty.
- Add AdministrativeObligation.
- Add ObligationDueItem.
- Add AdministrativePayment.
- Add AdministrativeCustomFieldDefinition.
- Add one additive migration only.
- Add recurrence/due/lifecycle unit tests.

## CA-02 — Mutation APIs

- Counterparty create.
- Obligation create and lifecycle transitions.
- Next/manual due item creation.
- Payment request, approval/rejection, payment recording, reconciliation and void.
- Custom field create/update/deactivate.
- Zod on every request body.
- Session-derived actor IDs and audit events.

## CA-03 — Responsive operating UI

- Corporate overview with due/approval/reconciliation attention counts.
- Responsive obligations registry.
- New obligation form.
- Counterparty registry/create flow.
- Obligation detail with due schedule and payment workflow.
- Custom-fields settings.
- Desktop table + mobile stacked records where scan patterns differ.

## CA-04 — Verification

- Prisma generation/migration rehearsal.
- Typecheck, lint, Vitest, invariant checker, build.
- Browser/Playwright acceptance path when environment is available.
- Do not merge until migration and application build both pass.

## Explicit deferrals

No storage provider, accounting posting, AP invoice model, procurement workflow, asset master, configurable approval engine, scheduled reminder system or RRULE engine in this MVP.

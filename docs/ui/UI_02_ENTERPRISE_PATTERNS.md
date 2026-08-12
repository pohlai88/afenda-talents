# UI-02 — Shadcn Studio Enterprise Patterns

**Status:** Implemented on `ui/shadcn-studio-enterprise-patterns`  
**Stacked on:** UI-01 (`ui/shadcn-studio-foundation`)  
**Proving ground:** Corporate Administration only

## Purpose

UI-02 converts the UI-01 primitives into higher-order enterprise patterns that can be reused by other Afenda domains after Corporate Administration is visually accepted.

The phase is intentionally limited to interaction patterns already justified by current workflows. It does not introduce bulk operations, command palettes, saved views, new business rules, schema changes, or Hiring/Talents migration.

## Reusable components added

### Dashboard and attention

- `AfendaMetricCard` — semantic KPI/summary card with optional navigation.
- `AfendaAttentionList` — responsive ordered attention queue with empty state, metadata and status slots.

### Governance actions

- `AfendaConfirmAction` — reusable AlertDialog-based confirmation contract.
- `AfendaConfirmButton` — standard button-triggered confirmation surface.

Use confirmation for actions that are terminal, destructive, or represent a meaningful governance assertion. Do not add confirmation to routine low-risk navigation or editing actions.

### Register filtering

- `AfendaSelectFilter` — reusable shadcn Select filter compatible with `AfendaFilterToolbar`.

The standard register anatomy is now:

1. section title and purpose;
2. search;
3. structured filters;
4. filtered result count;
5. clear-filters action when state is active;
6. desktop table;
7. mobile record list;
8. domain actions via the approved row-action pattern.

## Corporate Administration adoption

### Overview

The control centre now uses reusable metric cards and the reusable attention list rather than hand-built metric links and a page-specific due queue.

### Counterparties

Filters:

- search;
- counterparty type;
- active/inactive status.

### Custom fields

Filters:

- search;
- record scope;
- active/inactive status.

### Obligations

The database query remains server-side. A serializable register DTO is passed into a client register component for filtering only.

Filters:

- search across core identity, owner, counterparty and visible custom fields;
- category;
- lifecycle status;
- attention state: overdue, due today, upcoming, or no next attention.

### Payments

The database query remains server-side. A serializable register DTO is passed into a client register component for filtering only.

Filters:

- search across obligation, period, counterparty, actor and request date;
- approval status;
- settlement status;
- reconciliation status.

### Governance confirmations

Confirmation is now required before:

- ending an obligation;
- cancelling an obligation;
- rejecting a payment request;
- reconciling a recorded payment;
- voiding a recorded payment.

The confirmation copy explains the operational consequence before the action is committed.

## Boundaries preserved

- no database or Prisma schema changes;
- no API contract changes;
- no lifecycle/business-rule changes;
- no authentication changes;
- no Hiring/Talents UI changes;
- no bulk action framework;
- no command palette;
- no saved views or preference persistence;
- no premium Studio source redistributed in the repository.

## Verification

Verified head at phase completion: `975c31b214409b2e3118d0c0c47ac5d6ceeabcb6`.

- lint: pass;
- TypeScript: pass;
- Vitest: 26 files / 168 tests pass;
- repository mechanical invariants: pass;
- Prisma generation: pass;
- Next.js production build: pass;
- Vercel deployment: READY.

## Next recommended phase

Before migrating Hiring/Talents, continue Corporate Administration convergence around remaining one-off presentation patterns:

- activity/history presentation;
- evidence/reference presentation;
- loading/error/empty-state normalization where pages still use raw text;
- responsive overlay review (Dialog vs Sheet/Drawer at mobile widths);
- final visual/accessibility QA against selected Shadcn Studio Pro blocks when the premium registry/MCP is available.

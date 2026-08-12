# UI-04 Corporate Convergence & Polish

**Status:** implemented on `ui/shadcn-studio-corporate-convergence`  
**Base:** UI-03 Corporate operational detail convergence  
**Scope:** Corporate Administration + domain-neutral Afenda UI only

## Goal

Finish Corporate Administration as the reference Afenda enterprise UI before any Hiring/Talents migration. This phase does not add product features; it removes remaining presentation drift and makes the approved shared patterns consistent across routes, registers and operational records.

## Reusable Afenda additions

- `AfendaPageFrame` — one width, padding and vertical-rhythm contract for wide registers, record detail, forms and compact states.
- `AfendaActionBar` — mobile-sticky record lifecycle actions with desktop inline behavior.
- `AfendaCopyButton` — copy a recorded reference without exposing or modifying the source record.
- `AfendaEmptyState` compact mode and optional action — one full/filtered-empty-state contract.
- expandable `AfendaActivityTimeline` — recent-first audit history with safe optional details.

## Corporate convergence

### Page framing

The overview, obligations, payments, counterparties, custom fields, help/manual, obligation create/edit, obligation detail and route-level error surface now use `AfendaPageFrame`. Repeated `mx-auto / max-w / p-4 sm:p-6 / gap-6` page shells are no longer independently authored.

### Operational actions

Draft/active obligation lifecycle actions use `AfendaActionBar`:

- mobile: persistent bottom action surface with safe-area padding;
- desktop: normal inline action group;
- page detail reserves mobile bottom space so fixed actions do not cover record content.

This changes presentation only; activation/end/cancel/generate-due behavior is unchanged.

### Evidence and references

`AfendaEvidenceList` now gives each recorded reference the same treatment:

- monospace reference display;
- Copy action when a reference exists;
- Open evidence action when a URL exists;
- existing Available / Required / Not attached state remains visible.

No document store or upload system was introduced.

### Activity history

`AfendaActivityTimeline` now:

- shows the most recent eight events by default;
- allows users to reveal the full loaded history;
- expands optional event detail/metadata per item;
- uses the existing PII-safe `formatAuditMeta()` output before rendering audit metadata;
- keeps long histories rendering-efficient with content visibility.

No audit schema or retention behavior changed.

### Empty states

Full and filtered-empty states now use `AfendaEmptyState` across:

- obligation register;
- payment register;
- counterparty register;
- custom-field register;
- payment history inside a due item;
- existing due-item and activity empty states.

Filtered empty states use compact presentation; first-use empty states retain explanatory copy and actions where relevant.

## Deliberate non-goals

UI-04 does **not** add:

- bulk actions;
- saved views;
- command palette;
- customizable table columns;
- a new document subsystem;
- new audit facts;
- new database/API/business rules;
- Hiring/Talents UI changes.

These remain unjustified until actual usage demonstrates a need.

## Acceptance gate

Before this phase is considered stable:

1. lint passes with zero warnings;
2. TypeScript passes;
3. current Vitest suite passes;
4. repository invariants pass;
5. Prisma generation passes;
6. Next.js production build passes;
7. all Corporate routes compile;
8. changed-file scope remains Corporate/shared-Afenda UI plus this document only.

After UI-04, remaining work should be visual/accessibility reconciliation against the actual paid Shadcn Studio Pro registry when its authenticated MCP/CLI is available. Hiring/Talents should not introduce a second UI vocabulary.

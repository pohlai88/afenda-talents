# Afenda UI Standard — Shadcn Studio Pro

## Authority and rollout

Afenda uses Shadcn Studio Pro as the preferred source for reusable application components and blocks, then normalizes adopted patterns into Afenda-owned components. Existing shadcn/Base UI primitives remain the low-level interaction layer. Bespoke UI is a last resort and must be justified.

Rollout order is locked:

1. Corporate Administration is the proving ground.
2. Reusable Afenda components and blocks are created and verified there first.
3. Hiring/Talents migrates only after the shared layer is accepted.
4. Business behavior, APIs and database contracts are not rewritten merely to restyle a screen.

## Credential handling

Premium Studio credentials are local-only. The repository documents only the required variables:

```dotenv
EMAIL=""
LICENSE_KEY=""
```

Never commit real Studio credentials. `.env*` is gitignored in this repository.

## Reusable Afenda component contract

The Corporate Administration proving ground now establishes these shared components:

- `AfendaField` / `AfendaCheckField` — canonical label, required marker, control, helper and contextual help anatomy.
- `AfendaGuidanceButton` — field-level 4W1H guidance.
- `AfendaPageHelp` — page-level “How this works” guidance plus Guided Mode control.
- `AfendaRecordHeader` — canonical record identity/status/actions header.
- `AfendaNextAction` — explicit Do this / Why / Who operational guidance.
- `AfendaReadinessChecklist` — required vs optional readiness before lifecycle actions.
- `AfendaWorkflowStepper` — responsive operational progression.
- `AfendaSection` — consistent titled operational surface.
- `AfendaResponsiveDataView` — desktop table + mobile record presentation.
- `AfendaFilterToolbar` — standard search/filter surface.
- `AfendaRowActions` — standard overflow row action menu.
- `AfendaSubnav` — reusable responsive domain navigation.
- `AfendaGuidedModeProvider` — per-user inline-guidance preference scoped by domain rollout.

## Field assistance — 4W1H

Every governed guidance entry should answer:

- **What** — what the field or action means.
- **Why** — why Afenda or the business needs it.
- **Who** — who should provide or act on it.
- **When** — when it should be entered or changed.
- **How** — exactly how to complete the field or action.
- **Example** — when a concrete example improves understanding.

The short summary is shown inline when Guided Mode is on. The `?` action remains available when Guided Mode is off. Full contextual help deep-links to the Corporate Administration manual.

## Guided Mode

Guided Mode is ON by default for Corporate Administration and is remembered in local browser storage.

- **ON:** short helper guidance remains visible below fields.
- **OFF:** forms become compact while field-level `?` help remains available.

Guided Mode does not change validation, permissions, business logic or stored data.

## Responsive register standard

Operational registers use one structure:

1. Page header and page help.
2. Domain sub-navigation.
3. `AfendaSection`.
4. `AfendaFilterToolbar` where search/filtering is useful.
5. `AfendaResponsiveDataView`:
   - desktop/tablet: structured table;
   - smaller screens: record cards preserving the same important facts and actions.
6. `AfendaRowActions` for secondary row operations.

Do not independently recreate desktop/mobile markup on every page.

## Record-detail standard

Operational record pages should answer the user’s questions in this order:

1. **What record am I looking at?** — `AfendaRecordHeader`.
2. **What should I do now?** — `AfendaNextAction`.
3. **Where are we in the workflow?** — `AfendaWorkflowStepper`.
4. **Is the record ready for the next lifecycle step?** — `AfendaReadinessChecklist`.
5. **What are the governing facts/evidence?** — structured sections.
6. **What operational history/actions remain?** — due items, payments, activity, or domain-specific details.

Readiness logic must mirror actual server-side requirements rather than inventing separate UI-only rules.

## Manual and help architecture

Corporate Administration has an in-app manual at `/admin/corporate/help` with anchored chapters:

- `#obligations`
- `#due-items`
- `#payments`
- `#counterparties`
- `#custom-fields`

Contextual guidance automatically deep-links into the relevant chapter. Manual content should explain jobs and decisions, not database schema.

## Current proving-ground coverage

Corporate Administration now applies the shared layer to:

- obligation create/edit core, schedule, recurrence and contract/evidence;
- obligation record detail, next action, readiness and workflow progression;
- manual and generated due-item workflows;
- due-item/invoice editing;
- payment request, approval, settlement and reconciliation;
- counterparty create/edit and searchable register;
- custom-field definition, generated controls and searchable register;
- page-level help and Guided Mode;
- responsive sub-navigation;
- in-app manual and contextual deep links.

Hiring/Talents must remain unchanged until Corporate Administration receives visual/browser acceptance.

## Release gates

Before a reusable UI slice is promoted:

- lint passes;
- TypeScript passes;
- unit tests pass;
- repository invariants pass;
- Next.js production build passes;
- responsive behavior is verified at desktop and mobile widths;
- keyboard/focus behavior is checked for dialogs, sheets, menus and forms;
- no business/API/schema behavior changed unintentionally;
- where premium Studio source is available, selected blocks are compared and selectively ingested rather than blindly replacing working Afenda abstractions.

## Paid Studio ingestion boundary

The current ChatGPT execution workspace does not expose an authenticated Shadcn Studio MCP/registry connection. Therefore it must not claim that premium block source was installed when it was not.

When Studio MCP/CLI is available in the development environment:

1. Inspect the chosen Studio block/component.
2. Compare it against the existing Afenda abstraction.
3. Ingest only source that materially improves accessibility, responsiveness, interaction quality or maintainability.
4. Preserve Afenda component APIs so domain pages do not become coupled directly to a vendor registry.
5. Re-run all release gates and visual QA.

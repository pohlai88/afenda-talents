# Shadcn Studio UI Standard

**Status:** Proposed implementation standard for the next frontend phase  
**Scope order:** Corporate Administration first; Hiring and Talents only after the reusable layer is proven  
**Repository:** `pohlai88/afenda-talents`

## 1. Decision

Afenda will use Shadcn Studio Pro as the preferred source for reusable application components and blocks, while retaining the existing shadcn/ui primitives, application tokens, Next.js architecture, authentication, APIs, and domain logic.

The frontend source-of-truth order is:

1. **Shadcn Studio Pro blocks/components** — preferred reusable interaction and layout patterns.
2. **Existing shadcn/ui primitives** — low-level primitives and already-standardized controls.
3. **Afenda reusable composites** — domain-neutral wrappers/compositions built from the two sources above.
4. **Domain-specific UI** — may compose shared parts but must not create a competing design system.
5. **Bespoke UI** — last resort only, with a documented reason.

The goal is not to replace the application with a template. The goal is to create a stable responsive UI vocabulary once, prove it in Corporate Administration, and then migrate Hiring/Talents onto the same vocabulary.

## 2. Credential handling

Shadcn Studio CLI v4 uses two local environment variables:

```dotenv
EMAIL="<registered Shadcn Studio account email>"
LICENSE_KEY="<Shadcn Studio license key>"
```

The real credential values are intentionally **not stored in this public repository**.

Rules:

- Real values belong in local `.env` only.
- `.env` and `.env*` remain gitignored.
- `.env.example` contains placeholders only.
- Do not paste the license key into source files, `components.json`, shell scripts, package scripts, CI logs, screenshots, issue bodies, PR descriptions, test fixtures, or documentation.
- Do not use the license key as a runtime application secret; it is a development/design-time registry credential.
- If CI later needs premium Studio installation, add the values through the CI provider's encrypted secret store rather than source control.

## 3. Registry policy

The repository already uses shadcn and has a Shadcn Studio block registry configured in `components.json`.

When the premium registry setup is finalized, use the Studio CLI v4 namespaces by purpose:

- `@ss-components` — reusable premium/free components.
- `@ss-blocks` — reusable application blocks.
- `@ss-pages` — page-level patterns only when a page pattern is genuinely reusable.
- `@ss-themes` — theme assets only when they preserve Afenda's token authority.

Never install a large template wholesale over the current app. Import/select only the component or block needed, review its source, normalize it to repo conventions, and then make it reusable before domain adoption.

## 4. Corporate Administration is the proving ground

Corporate Administration is the first consumer because it exercises the widest reusable enterprise patterns without depending on candidate-specific UX:

- application shell and navigation;
- page headers and actions;
- responsive registries/data tables;
- filters and search;
- create/edit forms;
- record detail layouts;
- statuses and lifecycle actions;
- confirmation dialogs;
- drawers/sheets/popovers;
- empty/loading/error states;
- due/payment workflows;
- contextual help and field guidance;
- custom fields;
- mobile table-to-card transformations.

Do not migrate Hiring/Talents while these patterns are still changing. First prove the components through real Corporate Administration workflows and responsive QA.

## 5. Reusable component/block inventory

The next frontend phase should create a small, governed Afenda layer rather than scattered one-off JSX.

### Application structure

- `AfendaAppShell`
- `AfendaSidebarNav`
- `AfendaPageHeader`
- `AfendaPageTabs`
- `AfendaPageActions`
- `AfendaContentLayout`

### Registry and data display

- `AfendaDataTable`
- `AfendaTableToolbar`
- `AfendaFilterBar`
- `AfendaSearchInput`
- `AfendaResponsiveRecordList`
- `AfendaStatusBadge`
- `AfendaKeyValueList`
- `AfendaSummaryMetric`

### Forms

- `AfendaFormSection`
- `AfendaField`
- `AfendaFieldHelp`
- `AfendaMoneyField`
- `AfendaDateField`
- `AfendaReferenceField`
- `AfendaEvidenceField`
- `AfendaCustomFieldRenderer`
- `AfendaFormActions`

### Workflow and governance

- `AfendaWorkflowStepper`
- `AfendaNextAction`
- `AfendaReadinessChecklist`
- `AfendaConfirmationDialog`
- `AfendaApprovalPanel`
- `AfendaActivityTimeline`

### Feedback and assistance

- `AfendaEmptyState`
- `AfendaErrorState`
- `AfendaLoadingState`
- `AfendaInlineGuidance`
- `AfendaHelpDrawer`
- `Afenda4W1HHelp`

Components should remain domain-neutral wherever possible. For example, `AfendaApprovalPanel` may be used by payments today and another approval workflow later without copying the UI.

## 6. 4W1H assistance standard

The on-screen help framework is part of the reusable layer, not page-specific prose.

Every field that is not self-explanatory may define:

- **What** — what the field represents.
- **Why** — why Afenda needs it.
- **Who** — who should provide or maintain it.
- **When** — when it should be entered or changed.
- **How** — how to complete it correctly.
- **Example** — one concrete business example where useful.
- **Manual link** — optional deeper documentation anchor.

Presentation rule:

- Always-visible: label + concise one-line helper when needed.
- Desktop: detailed help in a consistent popover or side sheet.
- Mobile: detailed help in a drawer/sheet; never depend on hover.
- Validation: explain what is wrong, why it matters, and the corrective action.
- Custom fields: use the same help metadata so administrator-created fields do not feel second-class.

## 7. Responsive contract

Every reusable block must be validated at minimum in these modes:

1. narrow mobile;
2. wide mobile / small tablet;
3. laptop;
4. desktop.

Default behavior:

- Data-heavy desktop surfaces remain table/list oriented.
- Mobile converts only when necessary to readable record cards or stacked rows.
- Primary actions remain visible without horizontal scrolling.
- Dialogs that become cramped on mobile use Sheet/Drawer patterns.
- Form labels, help, validation, and required state remain adjacent to the field.
- No essential instruction is hover-only.

## 8. Adoption gates

A Studio component/block is not automatically an Afenda standard after installation. It becomes standard only after it passes:

1. **Source review** — dependencies, imports, accessibility, and interaction model understood.
2. **Token normalization** — semantic Afenda/shadcn tokens; no random color/style forks.
3. **API normalization** — reusable props and variants rather than page-specific conditions.
4. **Responsive QA** — no overflow, clipping, hidden actions, or unusable mobile layouts.
5. **Accessibility QA** — keyboard, focus, labels/titles, semantic states.
6. **Dark/light compatibility** — where the current product supports both.
7. **Corporate Administration use** — proven in at least one real workflow.

Only then may Hiring/Talents adopt it.

## 9. Implementation sequence

### Phase UI-01 — Studio foundation

- secure local Studio credentials;
- finalize premium registry configuration;
- inventory current shadcn components and Corporate Administration surfaces;
- select Studio candidates instead of writing replacement UI immediately;
- create the shared Afenda component namespace.

### Phase UI-02 — Forms + assistance

- standard field anatomy;
- form section/block;
- 4W1H help component;
- validation/help rules;
- custom-field integration;
- mobile form behavior.

### Phase UI-03 — Registry + record detail

- reusable data table/toolbar;
- responsive record list;
- status/lifecycle controls;
- reusable detail layout;
- next-action and readiness patterns.

### Phase UI-04 — Workflow patterns

- payment/due workflow stepper;
- approvals and confirmations;
- evidence/reference treatment;
- activity/history pattern.

### Phase UI-05 — Corporate Administration convergence

Replace Corporate Administration's one-off presentation with the approved shared components without changing domain behavior. Verify all screens visually and functionally.

### Phase UI-06 — Hiring/Talents migration

Only after UI-05 is stable:

- map existing Hiring/Talents screens to approved shared blocks;
- preserve candidate-specific public flows and auth boundaries;
- remove duplicated presentation code;
- avoid new visual patterns unless Corporate Administration cannot cover the requirement.

## 10. Definition of done

The reusable UI phase is complete when:

- Corporate Administration no longer relies on competing page-specific patterns for common forms, lists, dialogs, help, statuses, and record layouts;
- the shared layer works consistently on mobile and desktop;
- 4W1H guidance can be attached to built-in and custom fields through one contract;
- Studio-derived code is reviewed and normalized to Afenda conventions;
- Hiring/Talents can migrate by composition rather than redesigning each screen independently;
- no premium credential or account secret exists in git history.

## 11. Non-goals

This standard does **not** authorize:

- rewriting the Corporate Administration backend;
- replacing authentication;
- changing business workflow semantics merely to match a Studio demo;
- installing an entire dashboard template over the existing application;
- duplicating Studio source into a standalone component marketplace or redistributing premium resources outside the end product;
- redesigning Hiring/Talents before the shared Corporate Administration patterns are proven.

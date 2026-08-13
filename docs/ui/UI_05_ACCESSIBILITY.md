# UI-05 — Accessibility hardening

**Status:** implemented on the stacked UI-05 branch  
**Target:** WCAG 2.2 AA-oriented reusable Afenda UI hardening  
**Testbed:** Corporate Administration  
**Scope:** shared Afenda components/blocks and the primitive interactions they rely on

## 1. Purpose

UI-05 makes accessibility part of the reusable Afenda component contract rather than a page-by-page convention. Corporate Administration remains the reference implementation, while shared primitive improvements may benefit other authenticated Afenda surfaces automatically.

This work is accessibility hardening, not a formal accessibility certification. Conformance still requires executed browser/assistive-technology review in the target production environment.

## 2. Perceivable

- Workflow progress exposes Completed / Current step / Upcoming as text and screen-reader state, not colour alone.
- Readiness checks expose Ready / Needs attention / Optional explicitly, not only icon or colour.
- Evidence records keep textual Available / Required / Not attached states.
- Core light/dark text token combinations are protected by unit tests requiring at least 4.5:1 contrast.
- Forced-colour/high-contrast mode preserves important borders and focus outlines.
- Loading skeletons are hidden from assistive technology while a concise loading status is announced.

## 3. Operable

- The existing authenticated shell already provides a Skip to content link and a focusable main landmark; UI-05 preserves that foundation.
- Coarse-pointer controls receive a minimum 44px interaction height without inflating pointer-precise desktop density.
- Icon buttons expose their size as a DOM data attribute so touch-target rules can apply consistently.
- Checkbox visual size stays compact while its effective pointer target is expanded to approximately 44px.
- Activity details and Show all history use keyboard-operable disclosure semantics with `aria-expanded` and `aria-controls`.
- Contextual help triggers expose dialog state through `aria-haspopup` and `aria-expanded`.
- Responsive Sheet/Dialog workflows retain Escape-close and keyboard focus behavior from Base UI.
- Existing reduced-motion rules remain global and disable non-essential animation/transition duration.

## 4. Understandable

- `AfendaField` exposes programmatic label/description relationships and screen-reader wording for required fields.
- `AfendaCheckField` now binds the checkbox control to its visible label and helper text.
- Search/filter surfaces use semantic search inputs, a named search region and accessible filter labels.
- Filter result-count changes are announced politely.
- Copy-reference success/failure feedback is announced through a polite live region.
- Responsive overlays always expose both an accessible title and description, including a screen-reader-only fallback when a visible description is not supplied.

## 5. Robust semantics

- Workflow current state uses `aria-current="step"`.
- Next Action is a named region and uses definition-list semantics for Do this / Why / Who.
- Evidence collections use list semantics and a named region.
- Activity history is a named region containing a labelled ordered list and article-like event entries.
- Evidence links communicate that they open in a new tab through their accessible name.
- Page loading uses `role="status"`, `aria-live="polite"` and `aria-busy`.

## 6. Automated regression gates

### Normal `pnpm check` gate — executed

`tests/unit/corporate-accessibility-contract.test.ts` protects:

- labelled icon-only controls;
- live regions for copy/filter/loading feedback;
- disclosure semantics;
- workflow/readiness non-colour semantics;
- responsive overlay title/description presence;
- field/checkbox label associations;
- WCAG 2.2 touch-target and forced-colour safeguards;
- core Corporate light/dark text contrast at 4.5:1 or better.

At the verified UI-05 code checkpoint the normal gate passed **27 test files / 176 tests**.

### Playwright + axe — scenarios added

The repository already contains `@axe-core/playwright` and a shared WCAG test helper using `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` tags.

UI-05 extends that suite with deterministic Corporate Administration fixtures and scenarios covering:

- Corporate overview;
- obligations, counterparties, payments and custom-field registers;
- Corporate Help/manual;
- filter/search interactions;
- contextual 4W1H help;
- new-obligation form;
- obligation detail/workflow;
- narrow-mobile due-item Sheet opened by keyboard and closed with Escape.

These scenarios are committed and TypeScript-checked, but Vercel's standard `pnpm check` deployment gate does **not** run Playwright e2e. They therefore must be executed in an environment with the repository's e2e PostgreSQL setup before claiming browser-level axe completion.

## 7. Manual acceptance still required

Automated tooling cannot replace assistive-technology testing. Before representing Afenda as WCAG-conformant, perform at minimum:

- keyboard-only full Corporate workflow review;
- NVDA + Chromium/Firefox review on Windows;
- VoiceOver + Safari review on macOS/iOS;
- 200%/400% zoom and text-spacing review;
- Windows forced-colours/high-contrast review;
- mobile screen-reader and touch-target review;
- light/dark visual contrast review on actual supported browsers.

## 8. Guardrails

UI-05 does not introduce:

- database or Prisma schema changes;
- API changes;
- authentication changes;
- Corporate lifecycle/business-rule changes;
- new product features;
- premium Shadcn Studio source redistribution.

The paid Shadcn Studio Pro source/MCP still needs final visual/accessibility reconciliation when an authenticated Studio execution environment is available.

## 9. Definition of done for this phase

UI-05 is complete when:

1. the shared accessibility source contract passes the normal gate;
2. the full build remains green;
3. Corporate axe/keyboard scenarios are present and executable in the e2e harness;
4. the stacked PR scope is limited to accessibility/shared UI concerns;
5. no claim of formal certification is made without the remaining browser and assistive-technology acceptance work.

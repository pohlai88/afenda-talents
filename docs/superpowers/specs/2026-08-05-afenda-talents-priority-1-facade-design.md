# Afenda Talents — Priority 1: Facade Correction

**Status:** Approved design, ready for planning
**Date:** 2026-08-05
**Parent authority:** `docs/afenda-talents-complete-ui-ux-requirements.md` (promoted from Proposed to
authoritative by DECISIONS.md D17)
**Supersedes for this slice:** MVP build spec §12's prohibition on "analytics or dashboards beyond
the status counts", narrowly — see §11 below.

---

## 1. What this slice is

Delivery Priority 1 from the UI/UX requirements: design tokens, the admin shell, a meaningful
Overview, page headers, readable status vocabulary, and role-aware navigation.

It is a **facade** slice. It adds no API route, no mutation, no schema column, and no new tracked
event. Every number it shows is derived from rows the system already writes.

Two routes are created that were not strictly named in Priority 1, because Priority 1 cannot be
built without them:

- Requirements §6.2.F forbids destructive data actions on the Overview, and §11.1 forbids purge
  controls on the daily dashboard. The Danger Zone therefore has to move, so `/admin/data` exists.
- Requirements §4.1 requires Overview and Candidates to be distinct experiences. The Overview
  cannot become an operational summary while it still carries the full candidate table, so
  `/admin/candidates` exists.

Both ship **thin**. Their enrichment is Priority 2 and Priority 5 respectively.

---

## 2. Palette authority

> The authenticated application adopts Executive Navy, Governance Teal, Registry Blue, and Cool
> Porcelain as its operational design system. Compass Gold remains a restrained brand-signature
> accent for the logo, lockup, and selected brand details. It is not the primary button, progress,
> status, or general selection colour. The scoped `.af` landing-page palette remains unchanged.

Semantic hierarchy:

| Meaning | Colour | Hex |
|---|---|---|
| Primary application action | Executive Navy | `#14324A` |
| Information and focus | Registry Blue | `#1D5B79` |
| Operational progress | Governance Teal | `#2E7D7A` |
| Human review attention | Amber | `#B7791F` |
| Brand signature | Compass Gold | `#C8A96A` |
| Destructive action | Red | `#B42318` |

### 2.1 Token contract

`src/app/globals.css` keeps its structure — `@theme inline` mapping `--color-*` to bare variables,
a `:root` block, a `.dark` block, `@layer base`, and the print block. Only the `:root` values change,
plus two additions. Values are written as hex, not oklch: the requirements document specifies exact
hex and round-tripping through oklch would introduce drift for no benefit.

| Variable | Value | Source |
|---|---|---|
| `--background` | `#F4F7F8` | Cool Porcelain |
| `--foreground` | `#26333C` | Ink Charcoal |
| `--card`, `--popover` | `#FFFFFF` | White surfaces |
| `--card-foreground`, `--popover-foreground` | `#26333C` | Ink Charcoal |
| `--primary` | `#14324A` | Executive Navy |
| `--primary-foreground` | `#FFFFFF` | |
| `--secondary`, `--muted` | `#E8EEF0` | Porcelain tint |
| `--secondary-foreground`, `--accent-foreground` | `#14324A` | |
| `--muted-foreground` | `#5C6B75` | Slate |
| `--accent` | `#DCE7E6` | Teal tint, for hover and selected surfaces |
| `--destructive` | `#B42318` | |
| `--border`, `--input` | `#D9E2E7` | Border Mist |
| `--ring` | `#1D5B79` | Registry Blue — focus is information, not action |
| `--radius` | `0.625rem` | Unchanged; already inside the required 8–12 px band |

Three variables shadcn has no slot for, added to `:root` and exposed through `@theme inline` as
`--color-progress`, `--color-progress-foreground`, `--color-attention`,
`--color-attention-foreground`, and `--color-brand-gold`:

| Variable | Value | Use |
|---|---|---|
| `--progress` | `#2E7D7A` | Governance Teal. Operational progress and the `ready` status tone. Never candidate quality. |
| `--progress-foreground` | `#FFFFFF` | |
| `--attention` | `#B7791F` | Amber. Items needing human review or follow-up. Never quality. |
| `--attention-foreground` | `#FFFFFF` | |
| `--brand-gold` | `#C8A96A` | Compass Gold. Replaces the three hard-coded `bg-[#C8A96A]` diamonds in `app-sidebar.tsx`, `admin/login/page.tsx`, and `change-password-form.tsx`. |

`--accent` holds the teal *tint* `#DCE7E6` because shadcn uses `--accent` for hover and selected
surfaces, where full-strength teal would be far too loud. The teal itself lives in `--progress`.

Sidebar tokens resolve to a white surface with Ink Charcoal text, Navy for the active row, and
Border Mist for its edge. A fully navy sidebar was rejected: it reads as banking software, which
requirements §13.1 explicitly warns against.

`--chart-1` … `--chart-5` stay a neutral ramp. They are **not** repurposed as per-dimension colours;
see §6.4.

The `.dark` block is updated in step with `:root` so it is not left contradicting the new system,
but dark mode remains unreachable — nothing adds the `.dark` class, and this slice does not add a
theme toggle. It is maintenance, not a feature.

### 2.2 Typography

Geist and Geist Mono stay. They already satisfy requirements §13.3, and adding a display face would
cost payload on the candidate flow — which requirements §12.1 and the MVP spec both constrain to a
mid-range Android on mobile data — in exchange for nothing this slice needs. `--font-heading`
continues to alias sans.

Numerals in counts, percentages, and date columns use `tabular-nums`.

---

## 3. Status vocabulary

New pure module `src/lib/status-display.ts`. No Prisma import, no I/O — it is a presentation map and
is unit-testable in the existing vitest suite.

| Canonical status | UI label | Tone |
|---|---|---|
| `DRAFT` | Invitation prepared | neutral |
| `SENT` | Invitation sent | info |
| `STARTED` | Assessment started | progress |
| `SUBMITTED` | Processing results | progress |
| `SCORED` | Ready for review | ready |
| `EXPIRED` | Invitation expired | exception |
| `REVOKED` | Invitation revoked | exception |

`SUBMITTED` is **not** "Completed". Submission and scoring happen synchronously today, but
`SUBMITTED` remains a real intermediate state in `lib/status.ts`, and labelling it "Completed" would
tell a hiring manager a profile is available when it may not be.

Tones map to token-driven styles, never to a bare colour: `ready` uses Governance Teal because it is
operational progress, not candidate quality. No status is green, and no status is red — `exception`
is a muted outline treatment, since an expired invitation is an administrative fact, not an error.

Raw codes remain in the CSV export. Requirements §18.2 permits raw values in technical and audit
contexts, and the export's column contract is depended on by `06-export-audit-purge.spec.ts`.

`src/components/status-badge.tsx` consumes the map and renders a shadcn `Badge`, carrying the label
as real text — never colour alone (requirements §16).

---

## 4. Shell

`src/app/admin/(shell)/layout.tsx` and `src/components/app-sidebar.tsx`.

- **Collapse mode** changes from `collapsible="icon"` to `collapsible="offcanvas"`. Requirements
  §5.1 bans icon-only navigation; offcanvas gives mobile the drawer §5.1 asks for while desktop
  keeps 256 px with permanent text labels. Every `group-data-[collapsible=icon]:*` class in
  `app-sidebar.tsx` becomes dead and is deleted.
- **Brand area** gains the supporting label "Hiring Assessment Workspace" beneath "Afenda Talents".
  The diamond glyph switches from `bg-[#C8A96A]` to the `--brand-gold` token.
- **Active row** carries all three signals requirements §5.1 demands: background shift, heavier text,
  and a left indicator bar. `aria-current="page"` accompanies them.
- **Footer** becomes an account menu. User name, email, and role badge remain visible; "Change
  password" and "Sign out" move into a `DropdownMenu` triggered from the identity block. This
  satisfies §4.2 ("do not mix account utilities into the main operational navigation"), retires the
  footer overflow patched earlier in this branch, and puts the already-installed `dropdown-menu`
  primitive to work.
- **Navigation** is role-aware: Overview, Candidates, Invite (admin), Team (admin), Data & Audit
  (admin). Export CSV leaves the sidebar — it is a page action, not a destination, and moves to the
  Overview and the Candidates header.
- The skip link, the single `<main>` landmark, and `print:hidden` on the sidebar are already in
  place from earlier work in this branch and are preserved.

---

## 5. PageHeader

`src/components/page-header.tsx`. Props: `eyebrow?`, `title`, `description?`, `meta?: ReactNode`,
`actions?: ReactNode`. Stacks vertically below `sm`, with actions dropping under the title.

Props plus a `ReactNode` slot, not a compound component with context: there are five consumers, all
rendering a title and at most two buttons. Context plumbing would be ceremony without a payoff, and
the requirements' §14.1 property list maps directly onto props.

Every admin page adopts it, which is what finally makes §4.3's title hierarchy consistent.

---

## 6. Overview

`src/app/admin/(shell)/page.tsx`, a server component, `force-dynamic` as today.

### 6.1 Round summary

Name-based greeting — "Welcome back, {first name}" — deliberately **not** time-of-day. The server
runs UTC on Vercel while the hiring team is UTC+8, so "Good morning" would frequently be wrong, and
computing it client-side would introduce a hydration mismatch for cosmetic gain.

Beneath it, one sentence carrying: candidates in the round, how many are ready for review, and how
many items need follow-up. Then the last activity time.

**Time rendering rule:** durations ("3 days ago") are computed from a UTC difference and are
timezone-independent, so they are safe to render on the server. Absolute wall-clock times are not,
so dates continue to use the existing `toLocaleDateString("en-GB")` day-precision format and no
clock time is displayed anywhere in this slice.

### 6.2 Workflow strip

**Current-state distribution, not a conversion funnel.** Each candidate is counted once, in the
stage matching their present status:

```
Invitation sent → Assessment started → Processing results → Ready for review
```

Each stage shows its count, its percentage of the non-exception total, a one-line explanation, and
links to `/admin/candidates?status=<CODE>` so state lives in the URL.

`EXPIRED` and `REVOKED` are rendered separately as exceptions, outside the strip and excluded from
its percentage base. `DRAFT` is not shown — the invite flow moves a candidate to `SENT` in the same
request, so a persisted `DRAFT` row indicates a failure, not a stage.

Nothing here claims "ever reached stage" history. The system stores no stage-transition log, and
this slice does not add one.

### 6.3 Attention

Two separate blocks, so the hiring workflow stays legible.

**Hiring attention** — thresholds are named constants in `src/lib/attention.ts`, a pure module
taking already-fetched rows as arguments:

| Item | Rule |
|---|---|
| Invitation not opened | `status = SENT` and `openedAt is null` and `sentAt` at least 72 hours old |
| Assessment in progress | `status = STARTED` and last activity older than 72 hours, where last activity is `max(Response.updatedAt)` for that candidate, falling back to `startedAt` when no response row exists yet |
| Expiring soon | `status` is `SENT` or `STARTED` and `expiresAt` is within the next 72 hours |
| Profile awaiting first review | `status = SCORED` and no `result.viewed` audit event exists with `createdAt` later than that candidate's `Result.computedAt` |

**Workspace attention** — separate block, separate heading:

| Item | Rule |
|---|---|
| Temporary password not yet replaced | `User.mustChangePassword = true` |

Each row shows subject, reason, age or due context, and one direct action. Ordering is by
operational urgency only — never by any property of a candidate's answers. No reminder is sent;
"Resend invitation" stays an explicit administrator action, per requirements §6.2.C.

### 6.4 Recently completed profiles

The most recent `SCORED` candidates with name, completion date, five compact per-dimension
indicators, a neutrally phrased response-context count ("2 of 4 response-context indicators to
review" / "no response-context indicators"), and a "Review profile" link.

The five indicators are rendered in a single neutral tone with the dimension code as text and the
scaled value as text. **Colour never encodes band or quality**, per requirements §13.2 and §16 —
which is also why the chart tokens are not repurposed here. Each carries a screen-reader sentence
naming the dimension, its value, and its band.

No composite score, no ranking, no ordering by score, no pass/fail. Sort is by completion time.

### 6.5 Recent activity

The last eight audit events, filtered to hiring-meaningful actions: `invite.created`,
`invite.resent`, `invite.revoked`, `candidate.consented`, `assessment.submitted`, `result.viewed`,
`export.downloaded`. Sign-ins, password changes, and purges are excluded — the first two are noise,
and the last belongs on `/admin/data`.

Each row renders a sentence, never a raw action code. Actor ids resolve to user names and subject
ids to candidate names **at read time from the live tables**. Audit rows continue to store
identifiers only, so build-skill invariant 6 holds; requirements §11.2 explicitly permits read-time
resolution. A subject whose record has been deleted renders as "a candidate whose record was
deleted", not as a dangling id.

### 6.6 Primary actions and empty state

Header actions: Invite candidates, View all candidates, and Export results for administrators. No
destructive action appears on this page.

With zero candidates, the strip, attention blocks, and lists are replaced by the three-step journey
from requirements §6.3 — add details, review the invitation, send personal links — with "Invite your
first candidates" as the primary action and "Preview the invitation email" as secondary, deep-linking
to the preview dialog already built on `/admin/invite`.

### 6.7 Queries

Five reads, all server-side in the page component:

1. `candidate.findMany` including `result`, ordered by `createdAt`.
2. `response.groupBy` by `candidateId` taking `_max: { updatedAt: true }` — feeds the stalled rule.
3. `auditEvent.findMany` where `action = 'result.viewed'`, selecting `subjectId` and `createdAt` —
   feeds the awaiting-review rule.
4. `auditEvent.findMany` for the activity feed, ordered descending, limited.
5. `user.findMany` selecting id, name, and `mustChangePassword` — resolves actor names and feeds
   workspace attention.

One hiring round bounded by a 200-candidate invite cap makes in-memory aggregation the right call;
no index change is required.

---

## 7. Thin extractions

**`/admin/candidates`** receives today's table verbatim, plus a PageHeader and `StatusBadge`. It
reads `?status=` to filter, so the workflow strip's links resolve. Search, sorting, advanced
filtering, responsive cards, and pagination are Priority 2 and are explicitly out of scope.

**`/admin/data`** receives the retention summary and the existing `DangerZone`, admin-gated with the
same redirect pattern as `/admin/users`. Audit exploration is Priority 5 and is out of scope; the
page states that retention deletion is manual and describes what identity-free evidence survives.

---

## 8. Loading, error, and empty states

`loading.tsx` for each shell route, built from the installed `Skeleton` and shaped like the layout it
replaces — no full-page spinners (requirements §15.1). `error.tsx` boundaries for the shell,
rendering what failed and the next step, never a technical string, an identifier, or a token
(requirements §15.2).

---

## 9. Accessibility

WCAG 2.2 AA, verified at the end of the slice: keyboard-only traversal of the shell and Overview,
visible focus on every control, one `<main>`, `aria-current` on the active nav row, ~44 px touch
targets, colour never the sole signal, and screen-reader equivalents for the workflow strip
percentages and the compact dimension indicators.

---

## 10. Test impact

> **Corrected during execution.** This table originally listed three specs. Five actually reach the
> candidate table through `/admin`, and `01-admin-auth` asserts the old dashboard heading. See the
> plan's Task 11 for the full, verified list.

| Spec | Change |
|---|---|
| `01-admin-auth.spec.ts` | Asserted the old dashboard `h1` "Candidates"; now asserts the overview's "Welcome back…" |
| `03`, `04`, `05` | All reach the candidate table; each moves to `/admin/candidates`, and `03` expects "Ready for review" rather than `SCORED` |
| `02-invitations.spec.ts` | Row lookups move from `/admin` to `/admin/candidates`; `"SENT"` / `"REVOKED"` assertions become "Invitation sent" / "Invitation revoked" |
| `06-export-audit-purge.spec.ts` | Purge is driven from `/admin/data` instead of `/admin` (line 103) |
| `07-rbac.spec.ts` | The viewer's row assertion moves to `/admin/candidates`. Its "Delete all candidate data" absence assertion still passes — viewers cannot reach `/admin/data` at all, which strengthens rather than weakens the check |
| `helpers.ts` | `invite()` and `signIn()` are unaffected; both target routes that keep their paths and their `role="status"` contract |
| new vitest | `status-display.ts` and `attention.ts` get unit coverage, including every status and every threshold boundary |

The CSV export contract is untouched.

---

## 11. Invariants and non-goals

Build-skill invariants: this slice writes no status (3), adds no request body (4), leaves
`lib/scoring.ts` untouched (5), stores no identity in audit rows (6), imports neither auth module
into the other (7), and touches no candidate route (8). New routes sit under `/admin`, already
covered by `proxy.ts` and re-checked by the shell layout and by `/admin/data`'s own `requireAdmin`
(1). No raw token is read, logged, or rendered (2). Nothing computes an overall score, rank,
percentile, or recommendation (9).

**Out of scope, deliberately.** Search, sorting, advanced filtering, mobile candidate cards, full
audit exploration, dimension narrative interpretations, hiring conversation guides, the truthful
autosave redesign, submit confirmation, comparative analytics, and any additional candidate
tracking.

The profile already renders readable dimension names — `src/components/dimension-bar.tsx` maps
`WER` … `INA` to their full titles, and `tests/e2e/05-results.spec.ts` asserts them. What remains
outstanding there is the "Validity flags" → "Response context" rename and the hard-coded
`bg-slate-*` bars, which do not yet use the token system. Both are deferred to Priority 3, where
the profile work happens; this slice does not touch that page.

---

## 12. Acceptance criteria

1. Every admin page renders a PageHeader with title and one-sentence purpose.
2. No raw status code appears in the admin UI outside the CSV export.
3. The Overview shows current-state distribution, both attention blocks, recent completions, and
   recent activity — and no destructive control.
4. Workflow stage links land on `/admin/candidates` filtered by that status via the URL.
5. Attention rules match §6.3 exactly and are unit-tested at their boundaries.
6. The purge control exists only on `/admin/data` and only for administrators.
7. The sidebar shows text labels at every breakpoint and drawer-navigates on mobile.
8. Account utilities are in the footer menu, not in operational navigation.
9. Compass Gold appears only in brand lockups; no button, status, or progress element uses it.
10. Loading and error states exist for every shell route.
11. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `check-invariants.sh`, and `pnpm test:e2e` all pass,
    with output pasted.

# Afenda Talents — Candidate Detail + Timeline (Chunk 1)

> **For agentic workers:** Use this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `/admin/candidate/[id]` work for every status (fix View progress 404), with header, progress or profile body, activity timeline, print (SCORED), and admin actions.

**Architecture:** Server page loads the candidate always. Pure `buildCandidateTimeline` merges timestamps + invite resent/revoked audit rows into ordered events. Profile body stays for SCORED only; other statuses get a progress panel. Reuse `CandidateRowActions`, `StatusBadge`, `PageHeader`.

**Tech Stack:** Next.js App Router, shadcn/ui (Card, Button), vitest, Playwright.

## Global Constraints

- No `result`-only `notFound()`; missing candidate → 404, missing result → progress view.
- No pass/fail, ranking, overall score. No D17 narratives.
- Audit meta: ids only. Never log tokens.
- Viewers: no mutation controls. Admins: reuse row-actions confirms.
- `result.viewed` audit only when a result exists.
- Done when typecheck + unit tests + e2e evidence are pasted.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/candidate-timeline.ts` | Pure timeline builder |
| `tests/unit/candidate-timeline.test.ts` | Unit tests |
| `src/components/candidate-detail/timeline.tsx` | Timeline UI |
| `src/components/candidate-detail/progress-panel.tsx` | Non-scored progress |
| `src/components/candidate-detail/print-button.tsx` | Client print |
| `src/app/admin/(shell)/candidate/[id]/page.tsx` | Status-aware page |
| `tests/e2e/09-candidate-detail.spec.ts` | SENT + SCORED detail |

---

### Task 1: Timeline pure module

- [x] Create `buildCandidateTimeline` + unit tests
- [x] Verify: `pnpm test -- tests/unit/candidate-timeline.test.ts` — 4 passed

### Task 2: Detail UI components

- [x] Timeline, ProgressPanel, PrintButton (shadcn Card/Button)

### Task 3: Status-aware page

- [x] Rewrite candidate detail page
- [x] Verify: `pnpm typecheck` — clean

### Task 4: E2E

- [x] SENT opens (no 404); SCORED still shows profile
- [x] Verify: `pnpm test:e2e -- tests/e2e/09-candidate-detail.spec.ts` — 2 passed; `05-results` also passed earlier

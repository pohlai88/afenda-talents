# Afenda Talents — Candidate Assessment Polish (Chunk 4 / P4)

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Candidate completion experience per UI/UX §12 / Priority 4 — consent readability, sticky progress + autosave states, resume notice, review-before-submit, refined done page. Mobile-first; no countdown timers; no admin chrome.

**Architecture:** Shared `CandidateShell` for brand mark. Pure helpers stay thin. `AssessmentForm` owns save status, resume, and submit confirmation. Consent page is a server composition with a summary card. Done page stays non-disclosing.

**Constraints:** Two auth systems never mixed; token never logged; no overall score; mid-range Android.

## File Structure

| File | Role |
|---|---|
| `src/components/candidate/shell.tsx` | Brand + optional progress slot |
| `src/components/consent-form.tsx` | Checkbox + start (use shadcn Checkbox) |
| `src/app/a/[token]/consent/page.tsx` | Readable consent sections + summary |
| `src/components/assessment-form.tsx` | Progress, autosave, resume, confirm submit |
| `src/app/a/[token]/done/page.tsx` | Neutral completion copy |
| `tests/e2e/helpers.ts` + `03-candidate-flow` | Confirm dialog + invite review path |

---

### Task 1: Shell + consent — [x]

### Task 2: Assessment polish — [x]

### Task 3: Done page — [x]

### Task 4: E2E + typecheck evidence — [x]

## Done when (evidence)

- `pnpm typecheck` — clean
- `pnpm test:e2e -- tests/e2e/03-candidate-flow.spec.ts` — 2 passed
- Mechanical invariants — pass

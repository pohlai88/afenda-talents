# Afenda Talents — Invite Rework (Chunk 2 / P2B)

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Make `/admin/invite` match requirements §9 — workflow explainer, Single/Many tabs, parse-then-review, confirm-before-send, result summary — without changing invite API token handling.

**Architecture:** Pure `parseInviteLines` / `classifyInviteRows` for validation and duplicate detection. Client `InviteForm` drives entry → review → confirm → result. Existing emails loaded on the server page and passed in. Email preview stays on the shared builders.

**Tech Stack:** Next.js, shadcn Tabs/AlertDialog/Table/Card, Zod email check via simple regex or zod, vitest, Playwright.

## Global Constraints

- Never mint or preview a real token. Placeholder link only.
- Never log tokens. Invite API unchanged for token lifecycle.
- Admin-only page (existing gate).
- Max 200 candidates per request (API already enforces).

## File Structure

| File | Role |
|---|---|
| `src/lib/invite-parse.ts` | Pure parse + classify |
| `tests/unit/invite-parse.test.ts` | Unit tests |
| `src/components/ui/tabs.tsx` | shadcn Tabs |
| `src/components/invite-form.tsx` | Reworked UI |
| `src/components/invite-workflow.tsx` | Explainer steps |
| `src/app/admin/(shell)/invite/page.tsx` | Pass TTL + existing emails |
| `tests/e2e/02-invitations.spec.ts` + helpers | Flow updates |

---

### Task 1: Parse module — [x]

### Task 2: Tabs + form rework — [x]

### Task 3: Page wire-up — [x]

### Task 4: Tests — [x]

## Done when (evidence)

- `pnpm test -- tests/unit/invite-parse.test.ts` — 4 passed
- `pnpm typecheck` — clean
- `pnpm test:e2e -- tests/e2e/02-invitations.spec.ts` — 4 passed
- Mechanical invariants — pass

# Afenda Talents — Data & Audit Explorer (Chunk 5 / P5)

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Administrator Data & audit page per UI/UX §11 — audit activity explorer (filters, resolved actor, subject link, human actions), clearer retention summary, danger zone with affected count + confirm. Keep audit identity-free. Light a11y checks in e2e.

**Architecture:** Pure `lib/audit-display.ts` for labels/filtering. Server page loads events + resolves live names. Client explorer filters in memory (one hiring round). DangerZone gets `candidateCount` and an AlertDialog final step.

**Constraints:** Never show name/email from audit meta. Actor/subject names only from live User/Candidate tables. Purge stays off Overview.

## File Structure

| File | Role |
|---|---|
| `src/lib/audit-display.ts` | Labels, filter, meta formatting |
| `tests/unit/audit-display.test.ts` | Unit tests |
| `src/components/audit/audit-explorer.tsx` | Filterable audit table |
| `src/components/danger-zone.tsx` | Count + typed phrase + dialog |
| `src/app/admin/(shell)/data/page.tsx` | Wire explorer + retention |
| `tests/e2e/10-data-audit.spec.ts` | Explorer + a11y smoke |

---

### Task 1: Pure display helpers — [x]

### Task 2: Explorer + page — [x]

### Task 3: Danger zone polish — [x]

### Task 4: E2E + evidence — [x]

## Done when (evidence)

- `pnpm typecheck` — clean
- `pnpm test -- tests/unit/audit-display.test.ts` — 3 passed
- `pnpm test:e2e -- tests/e2e/10-data-audit.spec.ts` — 1 passed
- `pnpm test:e2e -- tests/e2e/06-export-audit-purge.spec.ts` — 3 passed (incl. dialog confirm)
- Mechanical invariants — pass

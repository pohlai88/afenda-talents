# Configurable Assessments — Delivery 1 Implementation Plan

> **For agentic workers:** Implement task-by-task. Checkboxes track progress.  
> **Authority:** D18 · `docs/superpowers/specs/2026-08-05-configurable-assessments-design.md` · `AGENTS.md`  
> **Produces:** schema expand, Core v1 embed/backfill, assignment-scoped auth/APIs, thin rounds + read-only Assessments UI, version-driven scoring  
> **Verification:** `pnpm test` · `pnpm typecheck` · `bash .claude/skills/afenda-talents-build/check-invariants.sh`

**Goal:** Ship versioned assessments and assignment-scoped candidates without a visual builder.

**Architecture:** Document-on-version JSON (Zod) on `Assessment`/`AssessmentVersion`; thin `HiringRound`; `CandidateAssignment` owns invite lifecycle; pure `scoreAssessment`.

**Tech stack:** Next.js App Router, Prisma/Postgres, Zod, Vitest, existing `@/components/ui`.

## Global Constraints

- Invariants 1–9 (assignment replaces candidate as status/token subject).
- No Prisma in `lib/scoring.ts`.
- Cookie `afenda_candidate`; claim `{ assignmentId }` only.
- UI: compose from existing shadcn primitives; match admin shell density/type (no `@afenda/ui-system` — not in this repo).
- Coding discipline: discriminants on items/rules; Zod at boundaries; no `any`.

---

## Task 1: Instrument document Zod + Core v1 builder

- Create: `src/lib/instrument-document.ts` (Zod schema + parse helpers + section integrity)
- Create: `src/lib/core-v1-document.ts` (embedded Core v1 from current instrument semantics)
- Test: `tests/unit/instrument-document.test.ts`

## Task 2: Version-driven scoring

- Rewrite: `src/lib/scoring.ts` → `scoreAssessment({ versionDocument, responses })`
- Keep thin compatibility wrappers only if tests/UI need them during cutover; prefer full switch
- Test: `tests/unit/scoring.test.ts` updated for Core v1 parity with old flags/dimensions

## Task 3: Prisma expand

- Update `prisma/schema.prisma` with new models + nullable bridge columns
- Migration: expand only (no JSON file read in migrate)

## Task 4: Backfill script

- Create: `scripts/backfill-assignments.ts` (transactional; validates Core v1; parity checks)
- Script: `pnpm db:backfill-assignments`

## Task 5: Status + auth cutover

- `lib/status.ts` → assignment-scoped `applyStatus`
- `lib/auth-candidate.ts` → assignment session helpers
- Update all candidate API/pages and admin invite/resend/revoke/export/detail

## Task 6: Admin UI — rounds + assessments + invite

- Nav + `/admin/rounds`, `/admin/assessments`, invite requires OPEN round
- Read-only assessment preview

## Task 7: Contract migration (after cutover verified)

- Drop legacy columns/`Item`; non-null FKs

## Task 8: Verify

- Unit tests, typecheck, invariant script, smoke e2e if DB up

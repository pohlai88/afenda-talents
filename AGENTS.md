<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Afenda Talents

Pre-employment self-assessment. Invitation only. Single hiring round, single admin.

Requirements: `afenda-talents-mvp-build-spec.md`.
Architecture and amendments: `docs/superpowers/specs/2026-08-04-afenda-talents-architecture-design.md`.
Implementation plan: `docs/superpowers/plans/2026-08-04-afenda-talents-mvp.md`.
Where the spec and the design document disagree, the design document wins. Deviations are
logged in `DECISIONS.md`.

## Commands

```
pnpm dev
pnpm prisma migrate dev
pnpm prisma db seed
pnpm test          # vitest, pure modules
pnpm test:e2e      # playwright against the Neon test branch
pnpm lint && pnpm typecheck
bash .claude/skills/afenda-talents-build/check-invariants.sh
```

## Rules

- Hiring users have roles: ADMIN acts, VIEWER reads. Every mutating handler calls requireAdmin(); read surfaces call requireHiringUser(). Candidates are never users — their token is their credential (D15).
- Two auth systems, never mixed: `lib/auth-admin.ts` and `lib/auth-candidate.ts`. No shared
  helper, no handler importing both.
- Every request-level gate is coarse. Every handler and every `/a/[token]/*` page re-reads the
  candidate row and re-checks status and expiry before acting.
- On `/a/[token]/*`, the candidate resolved from the token hash must equal the cookie's
  `candidateId`. Mismatch 404s.
- Status changes only via `lib/status.ts`.
- Zod-validate every API body.
- Never log, store, or audit a raw invitation token.
- `AuditEvent` never stores a name or an email — ids and non-identifying meta only.
- `lib/scoring.ts` stays pure — no Prisma imports.
- `totalSeconds` is the sum of per-item times clamped at 60s each, never wall-clock elapsed.
- Timing is client-reported. HR-facing copy says "self-reported".
- Candidate UI is mobile-first: assume a mid-range Android on mobile data.
- No pass/fail, no ranking, no single overall score anywhere.
- Check the spec's Non-goals list (§12) before adding any feature.
- Run typecheck and tests before declaring a phase done, and paste the output. A phase is not
  done because it looks done.

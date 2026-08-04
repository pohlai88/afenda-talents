# Afenda Talents

Pre-employment self-assessment. Invitation only. Single hiring round, single admin.

Requirements: `afenda-talents-mvp-build-spec.md`.
Architecture and amendments: `docs/superpowers/specs/2026-08-04-afenda-talents-architecture-design.md`.
Where the two disagree, the design document wins. Deviations are logged in `DECISIONS.md`.

## Commands

```
pnpm dev
pnpm prisma migrate dev
pnpm prisma db seed
pnpm test          # vitest, pure modules
pnpm test:e2e      # playwright against the Neon test branch
pnpm lint && pnpm typecheck
```

## Rules

- Two auth systems, never mixed: `lib/auth-admin.ts` and `lib/auth-candidate.ts`. No shared
  helper, no handler importing both.
- Middleware verifies JWT signature and expiry only — it cannot reach Prisma. Every handler
  and every `/a/[token]/*` page re-reads the candidate and re-checks status and expiry.
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

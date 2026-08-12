<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Afenda

Internal operating workspace. Current bounded contexts:

- **Talents** — invitation-only hiring assessments.
- **Corporate Administration** — counterparties, obligations, recurring due items and administrative payments (D19).

Talents requirements: `afenda-talents-mvp-build-spec.md`.
Talents architecture and amendments: `docs/superpowers/specs/2026-08-04-afenda-talents-architecture-design.md`.
Corporate Administration design: `docs/superpowers/specs/2026-08-12-corporate-administration-design.md`.
Deviations and decisions are logged in `DECISIONS.md` and the accepted domain design documents.

## Commands

```
pnpm dev
pnpm prisma migrate dev
pnpm prisma db seed
pnpm test          # vitest, pure modules
pnpm test:e2e      # playwright against the Neon test branch
pnpm lint && pnpm typecheck
pnpm exec node scripts/check-invariants.mjs
# or: bash .claude/skills/afenda-talents-build/check-invariants.sh
```

## Rules

- Internal workspace users have roles: ADMIN acts, VIEWER reads. Talents code may call `requireAdmin()` / `requireHiringUser()`; non-Talents domains use `requireWorkspaceAdmin()` / `requireWorkspaceUser()` from `lib/auth-workspace.ts`.
- Candidates are never users — their emailed token remains their credential.
- Two auth systems, never mixed: `lib/auth-admin.ts` and `lib/auth-candidate.ts`. No handler imports both.
- Every request-level gate is coarse. Every handler re-checks current database-backed authority before acting.
- On `/a/[token]/*`, the assignment resolved from the token hash must equal the cookie's `assignmentId`. Mismatch re-enters `/a/[token]` to re-mint the cookie (not `/done`).
- Talents assignment status changes only via `lib/status.ts`.
- Corporate Administration lifecycle rules live in `lib/corporate-admin/domain.ts`; do not persist UPCOMING/DUE/OVERDUE because those are derived from due dates.
- Corporate custom fields are defined through `AdministrativeCustomFieldDefinition` and validated server-side. Do not accept unknown ad-hoc JSON keys.
- Acting corporate approver/requester/reconciler identities come from the authenticated session, never from client-submitted email/name fields.
- Zod-validate every API body.
- Never log, store, or audit a raw invitation token.
- `AuditEvent` never stores a name or an email — ids and non-identifying meta only.
- `lib/scoring.ts` stays pure — no Prisma imports.
- `totalSeconds` is the sum of per-item times clamped at 60s each, never wall-clock elapsed.
- Timing is client-reported. HR-facing copy says "self-reported".
- Candidate UI is mobile-first: assume a mid-range Android on mobile data.
- No pass/fail, no ranking, no single overall score anywhere.
- Corporate Administration does not become accounting/AP/GL by implication. See D19 design boundary before adding financial posting features.
- Run typecheck and tests before declaring a phase done, and paste the output. A phase is not done because it looks done.

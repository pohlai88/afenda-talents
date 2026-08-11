# Afenda Talents production release gates

**Status date:** 2026-08-11  
**Release posture:** advanced MVP; production hardening in progress

This document is the release authority for production-quality work. A feature is not considered shipped merely because it renders or Vercel reports a successful build. Each gate requires code, migration, automated checks, operational evidence, and a rollback path.

## Temporary operating restriction

The Employee Verification module is being extracted from Afenda Talents into its own security and data boundary. Until that work is complete:

- do not upload real identity, medical, banking, payroll, or employment evidence;
- do not issue real employee case links;
- use synthetic records only;
- treat the previously shared verification administrator token as compromised and schedule its revocation with the replacement authentication release.

The hiring-assessment product may continue to use synthetic smoke records while the gates below are completed.

---

## Gate 0 — Reproducible release controls

### Required

- [x] CI workflow for clean migration, seed, lint, type-check, unit tests, invariants, production build, Playwright, and accessibility.
- [x] Repository ownership, dependency update policy, private security-reporting policy, and PR checklist.
- [x] Security and no-cache headers for candidate, admin, verification, and API routes.
- [x] Liveness and database-readiness endpoints.
- [ ] Required branch checks enabled for `main` in GitHub repository settings.
- [ ] Preview deployment validated from the Gate 0 PR.
- [ ] Production smoke checks pass after merge.

### Exit evidence

- GitHub Actions run is green on the PR.
- Vercel preview is `READY`.
- `/api/health/live` returns HTTP 200.
- `/api/health/ready` returns HTTP 200 against the intended database.
- Sensitive routes return `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`.

---

## Gate 1 — Atomic domain operations

### Candidate assessment

- [ ] Candidate submission is one transaction.
- [ ] Status changes use compare-and-set rather than read-then-update.
- [ ] Repeated submission returns the existing successful result.
- [ ] Result, status, audit, and email-outbox write commit together.
- [ ] Concurrent submission tests prove exactly one completion.

### Invitations and email

- [ ] Invitation and resend use a transactional outbox.
- [ ] Provider failure cannot leave an assignment falsely marked as delivered.
- [ ] Batch invitation returns per-recipient outcomes.
- [ ] Delivery retries are idempotent.
- [ ] Provider message IDs and failure codes are recorded without storing raw invitation tokens.

### Hiring-user access

- [ ] Protected handlers re-read the user or validate a server-side session record.
- [ ] Demotion, password reset, disable, and deletion revoke active sessions.
- [ ] The last-administrator rule is enforced transactionally.
- [ ] High-risk actions require recent authentication.

### Exit evidence

Failure-injection and concurrency tests pass. Terminating a request at any point cannot leave an impossible or misleading state.

---

## Gate 2 — Product and data-scope correctness

- [ ] Overview, candidate registry, invitation flow, and export require an explicit hiring-round scope.
- [ ] “All rounds” is a separate intentional view with a visible Round column.
- [ ] Registry search, filters, sort, and pagination are server-driven.
- [ ] Inviter, invitation-date, and submission-date filters are complete.
- [ ] Audit events include a subject type and resolve assignment-scoped events correctly.
- [ ] Assessment draft saves use optimistic concurrency.
- [ ] Assessment publication serialises version-number allocation.
- [ ] Team management shows account, password-change, creation, and session state.
- [ ] The profile narrative decision is documented: fixed approved copy or intentionally omitted.

### Employee Verification extraction

- [ ] Separate repository and Vercel project.
- [ ] Separate Singapore-region database represented by checked-in migrations.
- [ ] Named HR accounts with role-based access; no shared administrator token.
- [ ] Private object storage with signed download URLs, malware scanning, checksums, access audit, and retention.
- [ ] Case links expire, revoke, regenerate, and lock after submission.
- [ ] Review and closure use case revisions to prevent conflicting decisions.

---

## Gate 3 — Operable production service

- [ ] Structured logs with request IDs and no PII, credentials, raw tokens, or evidence content.
- [ ] Alerts for 5xx rate, latency, database failures, email backlog, evidence scan failures, and retention failures.
- [ ] Automated retention with legal-hold support and deletion receipts.
- [ ] Point-in-time recovery configured.
- [ ] Database restoration tested.
- [ ] Evidence-object restoration tested.
- [ ] Migration rollback procedure rehearsed.
- [ ] Chromium and WebKit core flows pass.
- [ ] Mobile, keyboard, reduced-motion, print, and WCAG 2.2 AA checks pass.
- [ ] Cold-start and representative-load measurements recorded.
- [ ] Production smoke test runs after every release.

---

## Production definition of done

A release may be promoted only when:

1. all required GitHub checks pass;
2. migrations have been tested from a clean database and against a production-like copy;
3. a rollback or forward-fix procedure is written;
4. the preview deployment has been exercised through its highest-risk user flow;
5. security, privacy, accessibility, and retention impacts are reviewed;
6. monitoring is active before traffic reaches the new version;
7. the post-deployment smoke test passes;
8. no unresolved P0 issue applies to the released flow.

## Change-control rule

Do not add unrelated product features while a P0 release blocker remains open. Production hardening has priority over visual refinement and feature expansion.

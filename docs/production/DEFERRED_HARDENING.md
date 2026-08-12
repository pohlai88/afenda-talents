# Deferred Hardening

**Status:** Canonical deferred-work register for the current production baseline.

Afenda Talents is production-deployed from `main`. Closed historical P0 issues are not active defects unless they are explicitly reopened against current production behavior.

## Source-of-truth order

When evaluating future work, use this order:

1. current `main` code and checked-in Prisma migrations;
2. automated tests and production release gates;
3. current production runtime and database behavior;
4. current architecture/production documentation;
5. closed historical issues only as design history.

Do not reopen or reimplement a closed issue solely because its original acceptance checklist is broader than the product that is currently shipped.

## Deferred topics

### Employee Verification extraction — archived from issue #4

**Current position:** Employee Verification remains intentionally co-deployed with Afenda Talents for the current baseline.

**Reconsider when:**

- Employee Verification becomes an independently operated product;
- real employee evidence requires a separately governed storage/authentication boundary;
- separate ownership, retention, regional placement, or compliance controls become mandatory.

Until then, extraction is an architecture option, not an application defect.

### Transactional email outbox — archived from issue #6

**Current position:** Email delivery remains outside the critical candidate-submission transaction. Delivery failure is handled without rolling back an otherwise successful candidate result.

**Reconsider when:**

- delivery volume or retry volume becomes operationally significant;
- business requirements demand durable exactly-once/at-least-once delivery processing;
- provider outages or retries require a worker/queue operational model;
- email delivery needs independent operational observability or reconciliation.

Until then, an outbox is resilience hardening, not a correctness prerequisite.

### Revisioned/offline autosave — archived from issue #9

**Current position:** Autosave is supported for the online assessment workflow and guarded against writes after the assignment becomes non-writable.

**Reconsider when:**

- offline assessment completion becomes a supported requirement;
- poor-connectivity usage produces measurable stale-write incidents;
- concurrent/out-of-order saves need deterministic conflict reconciliation;
- batch save/revision semantics become part of the product contract.

Until then, revisioned batch autosave is network-resilience enhancement work.

### GitHub-hosted Actions and branch protection — archived from issue #12

**Current position:** The application release gate is enforced through the Vercel production build plus clean PostgreSQL migration rehearsal and browser/accessibility validation. GitHub-hosted runners are currently unavailable for this repository/account, so `.github/workflows/ci.yml` is intentionally manual-only and the temporary runner-diagnostic workflow has been removed. This prevents known runner-control-plane failures from marking ordinary future PRs red.

**Reconsider when:**

- GitHub-hosted runners are enabled for the account/repository;
- required status checks and protected-branch enforcement are being configured;
- repository governance requires GitHub Actions to become a mandatory merge gate.

When re-enabling automatic GitHub Actions, restore pull-request/main triggers and the full migration + browser jobs from Git history or a newly reviewed workflow. Until then, do not debug application code to solve runner-control-plane failures.

## Completed historical P0s

The following issues are closed as completed and should be treated as resolved unless current behavior proves a regression:

- #5 — candidate submission/status atomicity and idempotency;
- #7 — current-session authority and session-version revocation for the shipped account model;
- #8 — explicit hiring-round scoping across operational surfaces;
- #18 — production Prisma migration/UserRole schema reconciliation.

## Reopening rule

A deferred or completed issue should be reopened only when at least one of these is true:

- current production behavior violates a shipped contract;
- a reproducible regression is demonstrated by a failing test or production incident;
- a previously deferred capability becomes an explicit product requirement;
- an external dependency/control becomes available and the repository intentionally adopts it.

When reopening, create or update acceptance criteria against the **current** codebase. Do not inherit stale assumptions automatically.

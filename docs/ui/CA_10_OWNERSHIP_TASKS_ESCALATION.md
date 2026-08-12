# CA-10 — Administrative Ownership, Tasks & Escalation

## Purpose

CA-10 closes the Corporate Administration operating loop. Administrative intelligence is no longer only a list of records or findings: important work can have an accountable owner, target date, lifecycle, source record and deterministic escalation state.

The bounded model is intentionally **administrative work**, not a generic project-management system.

## Work-item model

`AdministrativeWorkItem` carries:

- title and optional description;
- status: `OPEN | ACKNOWLEDGED | IN_PROGRESS | RESOLVED | CANCELLED`;
- priority: `LOW | NORMAL | HIGH | CRITICAL`;
- one accountable `ownerId` (nullable when responsibility is genuinely unresolved);
- source type and source record/key/href;
- due date;
- escalation level 0–3;
- acknowledgement timestamp/actor;
- resolution timestamp/actor/note;
- creator and audit timestamps.

Source types are deliberately bounded to Corporate Administration: Site, Counterparty, Obligation, Agreement Line, Due Item, Payment and Data Quality.

## Signals versus tasks

Derived operational intelligence remains derived. A work item is materialized only when work should be owned and closed.

The ADMIN-only **Sync operational work** action is conservative and idempotent. It creates tasks only for:

1. OPEN Due Items that are overdue or due within seven days;
2. ACTIVE recurring Agreement Lines with no next-due pointer.

A stable source key prevents duplicate work items when sync is repeated.

Advisory Data Quality review findings are not all auto-materialized because some may be intentional. They can be promoted into work deliberately through the work-item API/next UI slices.

## Lifecycle

Typical flow:

`OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED`

`CANCELLED` is terminal for work that no longer applies. Resolved work can be reopened by an explicit status update; resolution timestamps are cleared on reopen.

## Escalation

Escalation is deterministic and explainable. For unresolved work with a due date:

- Level 0: not overdue;
- Level 1: 1–2 days overdue;
- Level 2: 3–6 days overdue;
- Level 3: 7+ days overdue.

Resolved/cancelled work has level 0. There is no hidden risk score.

The sync endpoint refreshes escalation state and records escalation audit events.

## Work Queue UX

`/admin/corporate/work-items`

Views:

- Open;
- Mine;
- Unassigned;
- Overdue;
- All.

The queue exposes owner, due date, priority, lifecycle status, escalation level and a deep link to the authoritative Corporate record.

ADMIN users can:

- assign/reassign an owner;
- change priority;
- acknowledge;
- start;
- resolve;
- synchronize deterministic operational work.

Workspace viewers can read the queue without mutating it.

## Auditability

The existing PII-safe audit system is reused:

- `corporate.work_item.created`;
- `corporate.work_item.updated`;
- `corporate.work_item.resolved`;
- `corporate.work_item.escalated`.

Audit metadata stores identifiers/status/escalation levels, not user names or email addresses.

## Database safety

CA-10 introduces one additive table and indexes. Ownership/actor references are protected with foreign keys to existing users. The exact migration was rehearsed on the isolated Neon branch `br-twilight-wildflower-az4yjzc9`; verification returned 7 indexes and 4 user foreign keys. Production was not modified.

Prisma 7 is switched to supported schema-directory mode so `prisma/schema.prisma` and `prisma/work-item.prisma` are generated together without rewriting the existing monolithic schema file.

## Deliberate boundaries

CA-10 does not add:

- generic projects, boards, sprints or subtasks;
- comments/chat;
- arbitrary dependencies;
- automatic email/SMS/Slack notifications;
- inferred owners for Sites with no authoritative owner;
- AI prioritization or risk scoring;
- Hiring/Talents changes.

Future reminder delivery can consume the deterministic task/escalation state without changing the work-item semantics.

## Product principle

> Corporate Administration becomes operationally useful when the system can answer not only “what needs attention?” but also “who owns it, by when, what state is it in, and has it actually been resolved?”

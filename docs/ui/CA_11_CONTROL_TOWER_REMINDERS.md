# CA-11 — Administrative Control Tower & Reminder Delivery

## Purpose

CA-11 turns CA-10 Administrative Work into a focused management and operator command surface without introducing a second source of workflow truth.

Canonical model:

`Authoritative Work Item → Control Tower projection → Reminder delivery → Delivery evidence`

Task status, owner, priority, due date and escalation remain authoritative on `AdministrativeWorkItem`. Reminder records only prove communication attempts.

## Control Tower

Route:

- `/admin/corporate/control-tower`

Management exception metrics:

- Open;
- Due today;
- Due this week;
- Overdue;
- Escalated;
- Unassigned.

Focused work lenses:

- **Today** — unresolved work due today or already overdue;
- **This week** — unresolved work due from today through the next seven calendar days;
- **Escalated** — unresolved work with deterministic escalation above level 0;
- **Awaiting me** — unresolved work owned by the signed-in user;
- **Unassigned** — unresolved work with no accountable owner.

The Control Tower derives current escalation from the due date when rendered. Opening the page does not mutate work-item state.

## Reminder eligibility

A reminder is eligible only when the work item:

1. is unresolved;
2. has an accountable owner; and
3. is escalated or due within seven days.

Resolved/cancelled and unassigned work cannot receive reminders.

## In-app reminders

ADMIN users can generate in-app reminders for all currently eligible work.

A stable daily delivery key includes:

- work-item ID;
- recipient user ID;
- calendar date;
- current escalation level.

Repeated generation therefore does not create duplicate reminders for the same state/day.

## Email reminders

Email is deliberately **manual per work item**. CA-11 does not provide a bulk `Send all email` action.

The existing environment contract is reused:

- `RESEND_API_KEY`;
- `MAIL_FROM`.

Delivery flow:

1. reserve a unique delivery record before calling the provider;
2. if the same daily delivery key already exists, skip sending;
3. send through the Resend HTTP API only when transport configuration is present;
4. persist provider evidence/status;
5. audit the outcome using IDs rather than recipient email addresses.

Statuses:

- `QUEUED` — delivery record reserved;
- `SENT` — provider/in-app delivery succeeded;
- `BLOCKED` — email transport is not configured;
- `FAILED` — configured provider attempt failed.

Blocked/failed attempts remain visible in the Control Tower instead of disappearing behind a toast.

## Reminder persistence

CA-11 adds `AdministrativeReminderDelivery` with:

- work item;
- recipient user ID;
- channel;
- status;
- unique delivery key;
- rendered subject/body;
- provider message ID;
- failure code;
- creator;
- creation/sent timestamps.

Reminder delivery does **not** acknowledge, start, resolve, assign or otherwise mutate the related work item.

## Audit

PII-safe audit actions:

- `corporate.reminder.sent`;
- `corporate.reminder.blocked`;
- `corporate.reminder.failed`.

Audit metadata records identifiers/channel/failure code, not recipient email addresses.

## Database rehearsal

Migration `20260813050000_add_corporate_reminder_deliveries` was applied to the existing isolated rehearsal branch:

- Neon branch: `br-twilight-wildflower-az4yjzc9`;
- production database: untouched.

Verification returned:

- reminder-delivery table exists;
- 5 indexes;
- 3 foreign keys;
- channel/status check constraints present.

## Verification checkpoint

Code head: `f35769bfdde36d6454a9058173a3fdf461fc75b7`

- Vercel READY;
- lint pass;
- TypeScript pass;
- Vitest **38 files / 245 tests pass**;
- CA-11 Control Tower contract: **6 tests pass**;
- repository mechanical invariants pass;
- Prisma multi-file schema generation pass;
- Next.js production build pass;
- 37 static pages generated;
- `/admin/corporate/control-tower` compiled;
- `/api/admin/corporate/control-tower/reminders` compiled.

## Deliberate boundaries

CA-11 does not add:

- a second notification-owned workflow state;
- automatic bulk email blasts;
- SMS/WhatsApp/Slack delivery;
- user-configurable notification rule builders;
- cron/scheduler infrastructure;
- AI prioritization;
- hidden management scoring;
- task comments/chat;
- Hiring/Talents changes.

## Product principle

> Notifications should amplify authoritative work state, not become another place where administrative truth can drift.

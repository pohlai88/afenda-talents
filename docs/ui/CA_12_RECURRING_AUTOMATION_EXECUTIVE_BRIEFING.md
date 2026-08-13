# CA-12 — Recurring Automation & Executive Administration Briefing

## Purpose

CA-12 automates the repeatable parts of Corporate Administration without creating a second workflow truth.

Canonical chain:

`Corporate graph → Administrative Work → scheduled automation → reminder/digest delivery → execution evidence`

`AdministrativeWorkItem` remains authoritative for ownership, priority, due date, status and resolution.

## Production schedules

Vercel Cron is declared in `vercel.json` and is active only on production deployments.

- Daily: `30 0 * * *` = 08:30 Asia/Kuala_Lumpur.
- Weekly: `45 0 * * 1` = Monday 08:45 Asia/Kuala_Lumpur.

Both invoke:

`GET /api/admin/corporate/automation/cron`

The route fails closed unless `CRON_SECRET` is configured and the request carries the matching Bearer token. Unknown schedules are rejected.

## Daily automation

The daily run:

1. materializes deterministic operational work for open due items due within seven days and recurring lines missing a next-due pointer;
2. refreshes deterministic escalation levels;
3. creates one daily in-app reminder for each eligible owned work item;
4. computes the executive briefing from live Administrative Work;
5. emails the daily executive briefing to current ADMIN users when Resend transport is configured;
6. stores run evidence.

System-generated records keep human creator fields null. Audit actor is `system:corporate-automation`; cron never impersonates a human administrator.

## Weekly automation

The weekly Monday run performs the same source-of-truth synchronization and then sends a separately labelled weekly executive briefing. Monday intentionally has both the normal daily digest at 08:30 and the weekly digest at 08:45.

## Idempotency and retry doctrine

Every run has a unique period key:

- `daily:YYYY-MM-DD`
- `weekly:YYYY-MM-DD`

The run record is reserved before work begins. A second invocation for the same period returns `SKIPPED` instead of repeating task creation, reminders or executive email delivery.

This is deliberately at-most-once for a period. A failed/partial run remains visible for operator review instead of automatically retrying an external email and risking duplicate delivery.

Individual task-owner email reminders remain explicit/manual from CA-11. CA-12 does not add automated bulk owner email.

## Automation Run evidence

`AdministrativeAutomationRun` records only execution evidence:

- run key;
- DAILY/WEEKLY job type;
- RUNNING/COMPLETED/PARTIAL/FAILED/SKIPPED state;
- scheduled time;
- work items created;
- escalation changes;
- in-app reminders created;
- digest recipient/sent/failed counts;
- provider message/failure evidence;
- completion time.

It does not store business/reporting snapshots.

## Executive briefing metrics

`/admin/corporate/executive-briefing` derives metrics directly from Administrative Work:

- open;
- overdue;
- escalated;
- unassigned;
- due in the next seven days;
- work created in the last 30 days;
- work resolved in the last 30 days;
- percentage of the 30-day created cohort already resolved;
- median resolution days for work resolved in the last 30 days;
- open-work aging buckets: <3d, 3–6d, 7–13d, 14+d;
- owner workload: open, overdue, escalated and resolved-30d.

These are descriptive operational measures. There is no hidden risk, productivity or employee-performance score.

## Executive digest

Daily and weekly emails contain the same derived exception metrics and top owner workload exceptions. ADMIN recipients come from current Afenda User records with role ADMIN.

Delivery uses the existing `RESEND_API_KEY` and `MAIL_FROM` contract. Missing email transport produces PARTIAL run evidence; it is not reported as successful delivery.

## Arming state

The Executive Briefing page explicitly shows whether recurring automation is ARMED. If `CRON_SECRET` is absent it shows `NOT ARMED · configure CRON_SECRET`.

The repository intentionally does not generate or commit the secret.

## Database rehearsal

Migration `20260813060000_add_corporate_automation_runs` was rehearsed only on isolated Neon branch `br-twilight-wildflower-az4yjzc9`. Production was not modified.

## Deliberate boundaries

CA-12 does not add:

- a second reporting warehouse;
- arbitrary user-defined cron rules;
- automated task-owner email blasts;
- SMS/WhatsApp/Slack automation;
- hidden AI summaries or scoring;
- project-management concepts;
- Hiring/Talents changes.

## Product principle

> Automate repeatable administrative control, but keep every task, exception and metric traceable to the authoritative Corporate record that produced it.

---
name: afenda-talents-build
description: Use when writing, reviewing, or completing any code in the Afenda Talents repository, including any change touching authentication, candidate status, scoring, invitation tokens, audit rows, or consent text, and before declaring any build phase done.
---

# Afenda Talents Build Guard

## Overview

This repository handles job applicants' self-reported answers about their own weaknesses,
under one hiring manager, under Malaysian PDPA. Nine invariants protect that. They are not
style preferences — each one exists because breaking it either exposes a candidate's data or
lets someone answer as somebody else.

Sequencing lives in `docs/superpowers/plans/2026-08-04-afenda-talents-mvp.md`. This skill
governs correctness, and one rule about what "done" means.

**Violating the letter of an invariant is violating its spirit.**

## The Completion Rule

**A phase is done when its "Done when" command has been run and its output pasted. Not when
the code looks right.**

Every phase in the spec has a "Done when" block. Run it. Paste what it printed. If you are
writing "this should now work" or "the tests should pass", you have not finished — you are
predicting. Predictions are not evidence.

No exceptions:
- Not when the change is one line
- Not when you ran a similar command earlier
- Not when the test is slow
- Not when you are confident

## The Nine Invariants

| # | Invariant | Why it exists |
|---|---|---|
| 1 | No route reachable without an admin cookie or a valid token | The whole system is invitation-only; a reachable route is a data leak |
| 2 | Raw tokens live only in the email body and the URL | A token in a log or an error message is a permanent credential in plain text |
| 3 | `status` changes only through `lib/status.ts` | The transition table is the only thing stopping a submitted assessment being reopened |
| 4 | Every API handler Zod-validates its body before touching the database | |
| 5 | `lib/scoring.ts` imports nothing from Prisma and never writes | A `Result` must always be recomputable from `Response` rows alone |
| 6 | `AuditEvent` stores no name and no email | Audit rows survive the purge; PII in them makes the retention promise false |
| 7 | `auth-admin.ts` and `auth-candidate.ts` share no code and no importer | A shared helper is how an admin cookie ends up authorising a candidate route |
| 8 | Middleware is a coarse gate; every handler re-reads the candidate row | Edge middleware cannot see a revocation or a submission |
| 9 | No pass/fail, no ranking, no single overall number | A self-report presented as a score gets used as one |

Run `bash .claude/skills/afenda-talents-build/check-invariants.sh` before any commit. It
mechanically checks 2, 3, 5, 6, 7 and 9. The rest need your eyes.

## Before Adding Anything

Spec §12 lists what must not be built: multiple tenants, multiple admins, an item editor,
candidate accounts, SSO, server-side PDF, scheduled reminders, norms or percentiles, adaptive
items, proctoring, timers, localisation, job queues, Redis, ATS integration.

If a feature seems necessary anyway, write it in `DECISIONS.md` and move on. Do not build it.

## Rationalizations

| Thought | Reality |
|---|---|
| "I'll just log the token to debug this" | That log is retained. Log the `tokenHash` or the candidate id. |
| "Returning the token in the response makes the test easier" | The test reads `server.log`. That is why the console transport exists. |
| "One direct `status:` update, the transition is obviously legal" | Then `applyStatus` will allow it. Call it. |
| "Middleware already checked the cookie" | Middleware checked a signature. It cannot see that this candidate was revoked ten minutes ago. |
| "Scoring needs the items, so it needs Prisma" | Items are passed in as an argument. That is the whole point. |
| "The email in the audit row helps trace what happened" | `subjectId` traces it. The email survives purge and breaks the retention promise. |
| "An average across the five dimensions is genuinely useful" | It is the single number the spec forbids, and it is what turns a self-report into a rank. |
| "One shared `verifyJwt` for both cookies — same algorithm" | Same algorithm, opposite trust. Two files so a wrong import is visible in review. |
| "Randomising item order is better psychometrics" | It breaks the consistency-pair spacing the validity flags depend on. |
| "It's mid-range Android, a heavier page is fine" | Assume mobile data and a slow device. Many candidates have nothing else. |

## Red Flags — Stop

- About to write "this should now work" instead of pasting output
- A `console.log` whose argument could contain a raw token
- `db.candidate.update` with `status` in the `data` object
- An `import` of `auth-admin` under `api/candidate/`, or `auth-candidate` under `api/admin/`
- Any `import` in `lib/scoring.ts` beyond types
- A handler that trusts the cookie without re-reading the candidate row
- Adding a column, chip, or CSV field that summarises the five dimensions into one
- Reaching for a Non-goal because it "only takes a minute"

## Status of This Skill

**Untested.** The writing-skills method requires baseline pressure-testing with subagents
before authoring, and that was not run. The invariants and their reasoning come from the spec
and the design document; the rationalization table is predicted, not observed. Treat the table
as a starting point and add real rationalizations to it as they appear during the build.

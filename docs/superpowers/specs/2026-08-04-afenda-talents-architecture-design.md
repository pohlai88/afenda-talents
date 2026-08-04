# Afenda Talents — Architecture Design

**Date:** 2026-08-04
**Status:** Approved
**Relationship to the build spec:** `afenda-talents-mvp-build-spec.md` remains the primary
requirements document. This design records the architectural decisions the spec left open,
and the four places where the spec must be amended. Where the two disagree, this document wins.

---

## 1. What changed and why

The spec was written assuming SQLite in a single Node container. The deployment target is
Vercel with Neon Postgres. That single change invalidates three of the spec's assumptions —
the datasource, the in-memory rate limiter, and the Dockerfile — and exposes a fourth problem
that was latent regardless of hosting: a contradiction between the `rushed` validity flag and
the mandatory resume-after-closing-the-browser flow.

| # | Spec section | Amendment |
|---|---|---|
| 1 | §2, §3 | Postgres on Neon, not SQLite. `Json` columns replace stringified JSON. |
| 2 | §6 | Rate limiting moves to a `LoginAttempt` table; `ADMIN_PASSWORD` gains a length floor. |
| 3 | §5 | `totalSeconds` is a sum of clamped per-item times, not wall-clock elapsed. |
| 4 | §13 | A ninth invariant: `AuditEvent` never stores a name or an email. |

---

## 2. Data layer

### 2.1 Datasource

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // Neon pooled endpoint (PgBouncer)
  directUrl = env("DIRECT_URL")     // Neon direct endpoint, migrations only
}
```

Neon exposes two connection strings. Prisma Migrate opens advisory locks and issues DDL that
PgBouncer's transaction pooling cannot carry, so migrations must bypass the pooler. Omitting
`directUrl` produces migration failures that look like network faults and waste an afternoon.

`lib/db.ts` holds the standard `globalThis` singleton so that a warm lambda reuses one
`PrismaClient` rather than opening a connection per invocation.

### 2.2 Schema changes from spec §3

Postgres has real JSON, so `Result` stops stringifying:

```prisma
model Result {
  id                  String   @id @default(cuid())
  candidateId         String   @unique
  dimensionScores     Json
  validityFlags       Json
  totalSeconds        Int      // sum of clamped Response.msOnItem — self-reported
  serverWindowSeconds Int      // max(updatedAt) - min(updatedAt) — server-observed
  computedAt          DateTime @default(now())
  candidate           Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
}
```

The spec's instruction to "parse at the boundary, never store objects raw" is obsolete here.
Zod still validates the shape on write, because a `Json` column will accept anything.

New table for rate limiting:

```prisma
model LoginAttempt {
  id        String   @id @default(cuid())
  ip        String
  createdAt DateTime @default(now())

  @@index([ip, createdAt])
}
```

Everything else in spec §3 is unchanged: `Candidate`, `Item`, `Response`, `AuditEvent`, the
seven status values, and the transition table enforced solely by `lib/status.ts`.

---

## 3. Timing: what is measured and who reports it

### 3.1 The contradiction being resolved

Spec §15 step 3 requires a candidate to close the browser halfway through and return later.
Spec §5 defines `rushed` as `totalSeconds < 240`. If `totalSeconds` were
`submittedAt − startedAt`, every candidate who takes the mandated break records hours of
elapsed time, and the flag becomes unreachable for exactly the population it exists to detect.
The two requirements silently contradict each other.

### 3.2 Resolution

`totalSeconds = Σ min(Response.msOnItem, 60_000) / 1000`

Clamping each item at 60 seconds prevents an idle tab from inflating the total. The result
means "seconds of actual attention," which is what the 240-second threshold is testing for,
and it survives the resume flow correctly.

### 3.3 Honest framing

`msOnItem` is measured by client-side JavaScript and posted by the browser. Anyone who opens
devtools can send whatever they like. This is acceptable — spec §13.8 guarantees flags never
gate anything — but the HR-facing copy must not imply the timing was observed by the server.

The profile page therefore renders the `rushed` chip as:

> Self-reported time on task was under 4 minutes.

`serverWindowSeconds`, derived from `max(Response.updatedAt) − min(Response.updatedAt)`, is
stored and displayed beside it as server-observed elapsed time. No logic reads it in the MVP.
It exists so the HR Manager can see both numbers and draw their own conclusion, and so a
future version has the data without a migration.

---

## 4. Authentication and authorisation

### 4.1 The request gate is coarse by choice, not by constraint

Next 16 replaces `middleware.ts` with `proxy.ts` and an exported `proxy()` function. Unlike
Next 15 middleware, **`proxy` runs on the Node.js runtime** — the runtime is fixed and cannot
be set to edge — so it *could* reach Prisma and make a full authorisation decision.

It does not. `proxy()` verifies **only the JWT signature and expiry**. It does not know whether
a candidate has since been revoked, has already submitted, or has passed `expiresAt`.

Two reasons, and neither is a platform limitation:

1. **The handler must check anyway.** A gate that ran the full check would duplicate a query
   the handler still has to perform, on every matched request, for no added safety.
2. **An authoritative-looking gate invites handlers to trust it.** The failure mode this
   design most needs to avoid is a handler that skips its own status check because "the gate
   already handled it." A gate that is visibly partial cannot be leaned on.

**Consequence, and it is not optional:** every `/api/candidate/*` handler and every
`/a/[token]/*` page re-reads the candidate row and re-checks status and expiry before acting.
A valid unexpired cookie proves only that this browser passed the token check at some point in
the last four hours. It does not prove the candidate is still permitted to proceed.

Route handlers in the App Router already default to the Node runtime. The explicit
`export const runtime = 'nodejs'` in Prisma-touching handlers is documentation of intent, not
a behavioural change.

### 4.2 Two credentials, two jobs

The path token and the candidate cookie are not redundant. They authenticate different things:

- **The path token authenticates page renders.** `/a/[token]`, `/a/[token]/assessment` and
  `/a/[token]/done` hash the path segment, resolve the candidate, and check status and expiry.
- **The cookie authenticates `/api/candidate/*` calls**, which carry no token in their path.

**They must agree.** On every `/a/[token]/*` render, the candidate resolved from the token hash
must equal the `candidateId` in the cookie, or the request 404s exactly as a bad token does.
This closes the shared-device case: a stale cookie from one candidate meeting another
candidate's link on a shared Android phone, which spec §13.6 tells us to expect.

The obvious wrong simplification — dropping the cookie and putting the raw token in POST
bodies — is rejected. Request bodies land in platform logs, and spec §13.2 permits raw tokens
in exactly two places: the email body and the URL.

Spec §6's hard rule stands unchanged: `lib/auth-admin.ts` and `lib/auth-candidate.ts` are
separate files, share no helper, and no handler imports both.

### 4.3 Rate limiting

`lib/rate-limit.ts`, backed by `LoginAttempt`:

- A row is written **on failed attempts only**. Writing on every attempt would lock out an
  admin who legitimately logs in five times in an afternoon.
- **A successful login deletes that IP's rows.** The counter measures a run of failures, not
  lifetime usage.
- More than 5 rows for the IP in the trailing 15 minutes → `429`.
- Rows older than an hour are deleted opportunistically on each call. No cron.

Per-IP limiting is necessary but not sufficient: there is one static password behind one public
URL, so a distributed attempt sidesteps IP counting entirely. The real defence is entropy.
`lib/env.ts` rejects an `ADMIN_PASSWORD` shorter than 24 characters at boot, alongside the
existing §9 checks. A generated 24-character password is not guessable at any rate the network
permits, which is the property that actually matters here.

---

## 5. Retention and erasure

Spec §13.7 requires the consent text to state how long data is kept. Nothing in the spec ever
deletes anything. With a SQLite file you could quietly delete the file; with a managed Postgres
you cannot. The promise needs a mechanism or it is not a promise.

`RETENTION_DAYS` joins the env schema and is **interpolated directly into the consent text**,
so the stated period and the configured period cannot drift apart.

Two admin actions, each requiring a typed confirmation phrase and each writing an
`AuditEvent`:

1. **Delete one candidate** — the PDPA erasure right. Cascades to `Response` and `Result`.
2. **Purge all candidate data** — the end-of-round action the retention promise depends on.

### 5.1 The ninth invariant

Purge is only honest if nothing identifying survives it. `AuditEvent` rows are retained as the
record that the purge itself happened, so:

> **`AuditEvent` must never store a name or an email.** `subjectId` holds a candidate id;
> `meta` holds non-identifying data only.

This joins spec §13's eight constraints and is enforced by the build skill. It also composes
with §13.2 — no raw tokens in audit rows — giving one simple rule: audit rows carry
identifiers, never identities or secrets.

---

## 6. Testing

Automated coverage is split by what each layer can actually catch.

**Vitest, pure modules, no database:**
`lib/scoring.ts` per spec §11 Phase 2 — all-3s baseline, a reverse-scored item, each of the
four flags triggering and not triggering, band boundaries at 44/45 and 69/70. Widened to
`lib/status.ts` (every legal transition passes, a representative illegal one throws) and
`lib/tokens.ts` (hashing is stable, tokens are unique, raw tokens never round-trip).

**Playwright, against a Neon `test` branch:**
The nine acceptance criteria of spec §15, so that go-live verification is a command rather than
a checklist. Specs accrete per phase instead of landing as one lump at the end:

| Phase | Playwright coverage added |
|---|---|
| 3 | `/admin` redirects when logged out, loads when logged in, 6 failures return 429 |
| 4 | Invite two, both `SENT`; revoke 404s the link; resend invalidates the old link |
| 5 | Consent → answer → close context → reopen → answers intact → submit; unanswered item rejected |
| 6 | Profile renders five bands and the flag chips |
| 7 | CSV has the right rows; audit shows every action and no raw token |

Tests run against a dedicated Neon branch reset with `prisma migrate reset`. Same engine as
production, no Docker requirement, and no risk to the round's real data.

---

## 7. Build sequence

Spec §11's eight phases, amended. Phases 1–6 keep their "Done when" gates as written except
where noted.

| Phase | Content | Change from spec |
|---|---|---|
| 1 | Scaffold, Prisma schema, `data/instrument.json`, idempotent seed | Neon project + `test` branch; `DATABASE_URL`/`DIRECT_URL` split; Playwright config scaffolded but empty |
| 2 | `lib/scoring.ts` + tests | Unit tests widen to `status.ts` and `tokens.ts` |
| 3 | Admin auth, login page, proxy gate, rate limiting | `LoginAttempt` table; failures-only limiter; 24-char `ADMIN_PASSWORD` floor |
| 4 | Tokens, status, email console transport, invite/resend/revoke, dashboard | unchanged |
| 5 | Candidate flow: token validation, consent, 34-item form, autosave, submit | Adds the token/cookie agreement check on every `/a/[token]/*` render |
| 6 | Results view: five bars, bands, flag chips, item table, print stylesheet | Flag copy names self-reported timing; shows `serverWindowSeconds` |
| 7 | CSV export, audit, hardening | Adds delete-one and purge-all; audit rows verified free of names and emails |
| 8 | Deploy | Vercel, **no Dockerfile**; adds a cold-start check on a real phone |

**Phase 8 cold start.** Neon's free tier autosuspends after inactivity. The first candidate to
open a link after a quiet period pays a multi-second wake-up, on a phone, on mobile data,
looking at a blank screen. This is a Phase 8 verification item — measure it, and if it is bad,
either move to a paid Neon tier or accept it knowingly. It should not be discovered by a
candidate.

---

## 8. Unchanged from the spec

Stated so that nothing is assumed to have been silently revised: the instrument and its 34
items and fixed presentation order (§4); all scoring arithmetic, bands, and the four validity
flag rules (§5); every route and its behaviour (§7); the three email templates and the console
transport (§8); the file tree minus the Dockerfile (§10); the entire Non-goals list (§12); and
constraints 1–8 of §13, now joined by the ninth in section 5.1 above.

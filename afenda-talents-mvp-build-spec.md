# Afenda Talents — MVP Build Specification

**Purpose:** pre-employment self-assessment, invitation only, single hiring round.
**Audience:** Claude Code, building this end to end.
**Version:** 1.0 — single-use MVP.

---

## 0. How to use this document

This is a build order, not a wish list. Work through the phases in sequence. Each phase has a **Done when** block — verify it before moving on. Do not start a later phase early, and do not implement anything in section 12 (Non-goals).

If a decision is not specified here, choose the most conventional option for the stack and note it in `DECISIONS.md`. Do not ask for clarification on styling, folder naming, or library minutiae — pick something sensible and keep moving.

---

## 1. What this system is

One organisation runs one hiring round. An HR Manager invites named candidates by email. Each candidate receives a one-time link, gives consent, completes a 34-item Likert self-assessment, and submits. The system scores it, flags response-validity concerns, and shows the HR Manager a profile across five competency dimensions.

**Two views only:**

| View | Who | Entry |
|---|---|---|
| Admin | One HR Manager | `/admin/login`, password from env |
| Candidate | Invited people only | `/a/{token}`, one-time link |

There is no candidate registration, no password for candidates, no public signup of any kind. If a route can be reached without either an admin cookie or a valid invitation token, that is a bug.

**Single-use assumptions that simplify everything:** one organisation (no `tenant_id` anywhere), one instrument (seeded, not editable in the UI), one admin account (env credentials), one campaign (implicit — every candidate belongs to the same round). Do not build abstractions for the plural cases.

---

## 2. Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | One deployable, server actions and API routes in one place |
| Database | SQLite via Prisma | Single-use; a file is the correct amount of database here |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent, no design work needed |
| Auth | Custom, `jose` signed JWT in httpOnly cookies | NextAuth is overkill for one password and one token type |
| Email | Resend SDK, with a console transport for dev | Single dependency, no SMTP config |
| Validation | Zod on every API boundary | |
| Reports | Server-rendered HTML page, browser print to PDF | No PDF library in the MVP |
| Hosting | Single Node container, or Vercel + Turso if SQLite-on-serverless is a problem | |

Node 20+. Package manager: pnpm.

---

## 3. Data model

Full `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Candidate {
  id           String    @id @default(cuid())
  email        String    @unique
  fullName     String
  status       String    @default("DRAFT")
  tokenHash    String?   @unique
  expiresAt    DateTime?
  sentAt       DateTime?
  openedAt     DateTime?
  consentedAt  DateTime?
  startedAt    DateTime?
  submittedAt  DateTime?
  createdAt    DateTime  @default(now())
  responses    Response[]
  result       Result?
}

model Item {
  id             String     @id
  dimension      String
  order          Int
  text           String
  reverseScored  Boolean    @default(false)
  isValidity     Boolean    @default(false)
  responses      Response[]
}

model Response {
  id          String    @id @default(cuid())
  candidateId String
  itemId      String
  value       Int
  msOnItem    Int       @default(0)
  updatedAt   DateTime  @updatedAt
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  item        Item      @relation(fields: [itemId], references: [id])

  @@unique([candidateId, itemId])
}

model Result {
  id              String    @id @default(cuid())
  candidateId     String    @unique
  dimensionScores String
  validityFlags   String
  totalSeconds    Int
  computedAt      DateTime  @default(now())
  candidate       Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
}

model AuditEvent {
  id        String   @id @default(cuid())
  actor     String
  action    String
  subjectId String?
  meta      String?
  createdAt DateTime @default(now())
}
```

`dimensionScores` and `validityFlags` are JSON strings — SQLite has no native JSON column in Prisma. Parse at the boundary, never store objects raw.

**Status values:** `DRAFT`, `SENT`, `STARTED`, `SUBMITTED`, `SCORED`, `EXPIRED`, `REVOKED`.

**Legal transitions.** Enforce these in one function, `lib/status.ts`, and never mutate `status` outside it:

```
DRAFT   → SENT
SENT    → STARTED | EXPIRED | REVOKED
STARTED → SUBMITTED | EXPIRED | REVOKED
SUBMITTED → SCORED
SCORED  → (terminal)
EXPIRED | REVOKED → SENT   (resend only; issues a fresh token)
```

Any other transition throws.

---

## 4. The instrument

Seeded from `data/instrument.json`. Five dimensions, six items each, plus four validity items. Likert 1–5: 1 = strongly disagree, 5 = strongly agree.

Dimension codes: `WER` work ethic and reliability, `COM` communication and collaboration, `PSL` problem solving and learning agility, `ADR` adaptability and resilience, `INA` integrity and accountability, `VAL` validity (not scored as a competency).

```
WER-1  I complete tasks by the deadline I commit to.
WER-2  I keep track of my responsibilities without being reminded.
WER-3  I often leave tasks unfinished when they become tedious.        [reverse]
WER-4  I arrive prepared for meetings and work sessions.
WER-5  I follow through on commitments even when no one is checking.
WER-6  I let small tasks pile up before dealing with them.             [reverse]

COM-1  I check that others have understood what I meant.
COM-2  I ask questions when instructions are unclear.
COM-3  I find it difficult to give feedback to colleagues.             [reverse]
COM-4  I adjust how I explain things depending on who I am talking to.
COM-5  I listen fully before forming a response.
COM-6  I avoid raising concerns in group settings.                     [reverse]

PSL-1  I break unfamiliar problems into smaller parts.
PSL-2  I look for the underlying cause rather than the quick fix.
PSL-3  I wait for someone else to suggest an approach.                 [reverse]
PSL-4  I seek out skills I do not yet have.
PSL-5  I test my assumptions before committing to a solution.
PSL-6  I find it hard to change my approach once I have started.       [reverse]

ADR-1  I stay effective when priorities change at short notice.
ADR-2  I recover quickly after setbacks at work.
ADR-3  Unexpected changes leave me unsettled for a long time.          [reverse]
ADR-4  I look for what I can control in difficult situations.
ADR-5  I am comfortable working without complete information.
ADR-6  I struggle to perform when under time pressure.                 [reverse]

INA-1  I admit mistakes as soon as I notice them.
INA-2  I raise problems even when it is uncomfortable.
INA-3  I look for reasons outside myself when things go wrong.         [reverse]
INA-4  I keep confidential information confidential.
INA-5  I take responsibility for outcomes in my area of work.
INA-6  I bend rules when it makes the work easier.                     [reverse]

VAL-1  I have never been irritated by a colleague.                     [social desirability]
VAL-2  I have never made a mistake I regretted at work.                [social desirability]
VAL-3  I meet the deadlines I agree to.                                [consistency pair with WER-1]
VAL-4  I own up to my errors quickly.                                  [consistency pair with INA-1]
```

**Presentation order:** fixed as listed, not randomised. Randomising breaks the consistency-pair spacing and gives no benefit in an unproctored self-report instrument.

---

## 5. Scoring

All of this lives in `lib/scoring.ts` as pure functions with no database access. Test it directly.

**Item score.** `reverseScored ? 6 - value : value`.

**Dimension score.** Sum the six item scores (range 6–30), then scale:

```
scaled = Math.round(((raw - 6) / 24) * 100)
```

**Bands.** `scaled < 45` → Developing. `45–69` → Effective. `>= 70` → Strong.

**Validity flags.** Compute all four, always. Each is a boolean plus a short reason string.

| Flag | Rule |
|---|---|
| `impressionManagement` | `VAL-1 + VAL-2 >= 8` |
| `inconsistentResponding` | `abs(WER-1 − VAL-3) + abs(INA-1 − VAL-4) >= 4` |
| `straightLining` | the same raw value appears on 12 or more consecutive items |
| `rushed` | `totalSeconds < 240` |

Flags never change the scores. They are shown alongside the profile as confidence information for the HR Manager.

**Output shape:**

```ts
type Scored = {
  dimensions: { code: string; raw: number; scaled: number; band: "Developing" | "Effective" | "Strong" }[];
  flags: { code: string; triggered: boolean; reason: string }[];
  totalSeconds: number;
};
```

Scoring runs synchronously inside the submit handler. No queue in the MVP.

---

## 6. Authentication

Two independent mechanisms. They must not share a cookie name, a claim shape, or a verification function.

**Admin.** `POST /api/admin/login` compares the submitted password against `ADMIN_PASSWORD` using a timing-safe comparison. On success, set cookie `afenda_admin`: JWT signed with `APP_SECRET`, claim `{ role: "admin" }`, 8-hour expiry, `httpOnly`, `secure`, `sameSite: "lax"`. Rate limit to 5 attempts per IP per 15 minutes, in-memory Map is fine.

**Candidate.** Invitation token is 32 random bytes, base64url encoded, and appears exactly once — in the emailed URL. Store only `sha256(token)` as `tokenHash`. Never log the raw token, never write it to `AuditEvent.meta`.

On `GET /a/{token}`: hash the parameter, look up the candidate, and reject if not found, if `expiresAt` has passed, or if status is `REVOKED`, `SUBMITTED`, or `SCORED`. On success set cookie `afenda_candidate`: claim `{ candidateId }`, 4-hour expiry, same cookie flags.

**Middleware** (`middleware.ts`): `/admin/*` except `/admin/login` requires a valid `afenda_admin` cookie. `/api/admin/*` likewise. `/api/candidate/*` requires a valid `afenda_candidate` cookie. Everything else is public.

**Hard rule:** no admin API handler may ever read `afenda_candidate`, and no candidate handler may ever read `afenda_admin`. Keep the two verification helpers in separate files so a wrong import is visible in review.

---

## 7. Routes

**Candidate**

| Route | Method | Behaviour |
|---|---|---|
| `/a/[token]` | GET | Validate token, set candidate cookie, stamp `openedAt`, show consent page |
| `/api/candidate/consent` | POST | Stamp `consentedAt`, `startedAt`, status → `STARTED`, redirect to assessment |
| `/a/[token]/assessment` | GET | Render all 34 items on one scrolling page, restore saved answers |
| `/api/candidate/autosave` | POST | Upsert one `Response`. Body: `{ itemId, value, msOnItem }`. Debounce 800ms client side |
| `/api/candidate/submit` | POST | Reject if any item unanswered. Score, write `Result`, status → `SUBMITTED` then `SCORED`, clear cookie |
| `/a/[token]/done` | GET | Confirmation. Also what a used or expired token lands on |

**Admin**

| Route | Method | Behaviour |
|---|---|---|
| `/admin/login` | GET/POST | Password form |
| `/admin` | GET | Candidate table with status, invited date, submitted date; counts by status across the top |
| `/admin/invite` | GET | Form: one candidate at a time (name + email) plus a paste-many textarea accepting `Name, email` per line |
| `/api/admin/invite` | POST | Create candidates, generate tokens, send emails, status → `SENT` |
| `/api/admin/invite/[id]/resend` | POST | New token, new expiry, re-send, status → `SENT` |
| `/api/admin/invite/[id]/revoke` | POST | Null the `tokenHash`, status → `REVOKED` |
| `/admin/candidate/[id]` | GET | Result profile: five bars, band labels, validity flags, item-level responses in a collapsible table. Print-friendly |
| `/api/admin/export` | GET | CSV: email, name, status, submitted date, five scaled scores, four flags |

---

## 8. Email

Three templates, plain HTML, no images.

1. **Invitation** — who is inviting, what the assessment measures, roughly 12 minutes, the link, the expiry date, a line stating there are no right or wrong answers.
2. **Reminder** — sent manually by the HR Manager from the dashboard, not on a schedule.
3. **Submission receipt** — to the candidate on submit.

In development, when `RESEND_API_KEY` is absent, the email module writes the full message including the link to stdout instead of sending. This must work, because it is how the flow gets tested locally.

---

## 9. Environment

`.env.example`:

```
DATABASE_URL="file:./dev.db"
APP_URL="http://localhost:3000"
APP_SECRET="generate-32-bytes-of-random"
ADMIN_EMAIL="hr@example.com"
ADMIN_PASSWORD="change-me"
RESEND_API_KEY=""
MAIL_FROM="Afenda Talents <noreply@example.com>"
INVITE_TTL_DAYS="14"
```

Fail fast at boot: validate this with Zod in `lib/env.ts` and throw on a missing `APP_SECRET` or `ADMIN_PASSWORD`. Do not ship defaults for either.

---

## 10. File tree

```
afenda-talents/
├─ CLAUDE.md
├─ DECISIONS.md
├─ .env.example
├─ data/instrument.json
├─ prisma/schema.prisma
├─ prisma/seed.ts
├─ middleware.ts
└─ src/
   ├─ app/
   │  ├─ page.tsx
   │  ├─ admin/login/page.tsx
   │  ├─ admin/page.tsx
   │  ├─ admin/invite/page.tsx
   │  ├─ admin/candidate/[id]/page.tsx
   │  ├─ a/[token]/page.tsx
   │  ├─ a/[token]/assessment/page.tsx
   │  ├─ a/[token]/done/page.tsx
   │  └─ api/
   │     ├─ admin/login/route.ts
   │     ├─ admin/invite/route.ts
   │     ├─ admin/invite/[id]/resend/route.ts
   │     ├─ admin/invite/[id]/revoke/route.ts
   │     ├─ admin/export/route.ts
   │     ├─ candidate/consent/route.ts
   │     ├─ candidate/autosave/route.ts
   │     └─ candidate/submit/route.ts
   ├─ lib/
   │  ├─ db.ts        env.ts       audit.ts
   │  ├─ auth-admin.ts auth-candidate.ts
   │  ├─ tokens.ts    status.ts    scoring.ts   email.ts
   └─ components/
```

---

## 11. Build order

### Phase 1 — Foundation
Scaffold Next.js with TypeScript, Tailwind, shadcn/ui. Add Prisma with the schema in section 3. Write `data/instrument.json` with all 34 items and `prisma/seed.ts` to load them idempotently.
**Done when:** `pnpm prisma migrate dev && pnpm prisma db seed` produces 34 `Item` rows, and running seed twice still gives 34.

### Phase 2 — Scoring engine, before any UI
Implement `lib/scoring.ts` per section 5. Write unit tests with Vitest covering: an all-3s response set, a reverse-scored item, each of the four validity flags triggering and not triggering, and the band boundaries at 44/45 and 69/70.
**Done when:** all tests pass and `scoring.ts` imports nothing from Prisma.

### Phase 3 — Admin authentication
`lib/auth-admin.ts`, the login page, middleware protection, rate limiting.
**Done when:** `/admin` redirects to login when logged out, loads when logged in, and six rapid wrong passwords return 429.

### Phase 4 — Invitations
`lib/tokens.ts`, `lib/status.ts`, `lib/email.ts` with the console transport, the invite page, and the create/resend/revoke handlers. Dashboard shows the candidate table.
**Done when:** inviting two candidates prints two distinct links to stdout, both rows show `SENT`, and revoking one makes its link 404 on the next request.

### Phase 5 — Candidate flow
Token validation, consent page, the 34-item form with debounced autosave, and submit. On submit, call the Phase 2 scoring engine and persist a `Result`.
**Done when:** a link from Phase 4 walks through consent → assessment → done; a hard refresh mid-assessment restores every answered item; submit with an unanswered item is rejected with the unanswered ones highlighted; reopening the link afterwards lands on `/a/[token]/done`.

### Phase 6 — Results view
The candidate profile page: five horizontal bars with scaled scores and band labels, validity flags shown as neutral informational chips rather than warnings, collapsible item-level table, print stylesheet.
**Done when:** a submitted candidate's profile renders correctly and `Ctrl+P` produces a clean one-page layout with no navigation chrome.

### Phase 7 — Export, audit, hardening
CSV export. `lib/audit.ts` writing an `AuditEvent` on: admin login, invite created, invite resent, invite revoked, consent given, assessment submitted, result viewed, export downloaded. Confirm no raw token appears in any audit row.
**Done when:** the CSV opens cleanly in Excel and the audit table shows every action from a full end-to-end run.

### Phase 8 — Deploy
Dockerfile, a persistent volume for the SQLite file, `APP_URL` set to the real host, real `RESEND_API_KEY`, `ADMIN_PASSWORD` rotated off the dev value.
**Done when:** a candidate on a phone, on mobile data, can complete the assessment from a real emailed link.

---

## 12. Non-goals

Do not build any of these. If one seems necessary, note it in `DECISIONS.md` and move on.

Multiple organisations or tenants. Multiple admin users or role hierarchies. Multiple instruments or an item editor. Campaign management. Candidate accounts, passwords, or password reset. SSO or MFA. Server-side PDF generation. Scheduled or automated reminder emails. Norm tables, percentiles, or benchmarking against other candidates. Adaptive or branching item logic. Proctoring, webcam, tab-switch tracking, or paste detection. Timers or per-section time limits. Localisation or a second language. A background job queue. Redis. Analytics or dashboards beyond the status counts. Applicant tracking system integration.

---

## 13. Constraints that must survive every phase

1. No route reachable without an admin cookie or a valid token. Verify after every phase.
2. Raw tokens exist in exactly two places: the email body and the URL. Never in the database, logs, audit rows, or error messages.
3. `status` changes only through `lib/status.ts`.
4. Every API handler validates its body with Zod before touching the database.
5. Raw `Response` rows are never mutated by scoring. Recomputing a `Result` must always be possible from the responses alone.
6. The candidate UI is mobile-first. Assume a mid-range Android phone on mobile data — many candidates will have nothing else.
7. Consent is captured before the first item is shown, and the consent text names what is collected, who sees it, and how long it is kept. This is a PDPA 2010 obligation, not a nicety.
8. Results are framed as one input to a hiring decision. No pass/fail, no ranking, no single overall number anywhere in the UI or the export.

---

## 14. CLAUDE.md

Write this file at the repository root before Phase 1:

```markdown
# Afenda Talents

Pre-employment self-assessment. Invitation only. Single hiring round, single admin.
The full specification is in afenda-talents-mvp-build-spec.md — follow its build order.

## Commands
pnpm dev
pnpm prisma migrate dev
pnpm prisma db seed
pnpm test
pnpm lint && pnpm typecheck

## Rules
- Two auth systems, never mixed: lib/auth-admin.ts and lib/auth-candidate.ts.
- Status transitions only via lib/status.ts.
- Zod-validate every API body.
- Never log, store, or audit a raw invitation token.
- lib/scoring.ts stays pure — no Prisma imports.
- Candidate UI is mobile-first.
- Check the spec's Non-goals list before adding any feature.
- Run typecheck and tests before declaring a phase done.
```

---

## 15. End-to-end acceptance

The MVP is finished when this passes on the deployed instance:

1. Admin logs in with the env password.
2. Admin pastes three candidates and sends invitations. All three show `SENT`.
3. Candidate A opens the link on a phone, consents, answers all 34 items, closes the browser halfway, reopens the link, finds every prior answer intact, finishes, and submits.
4. Candidate A's link now shows the completion page, not the questions.
5. Admin opens Candidate A's profile: five dimension scores with bands, validity flags, item-level responses, prints cleanly.
6. Admin revokes Candidate B. Candidate B's link 404s.
7. Admin resends to Candidate C. The old link fails; the new one works.
8. CSV export contains three rows with the correct statuses.
9. The audit table shows every one of these actions and contains no raw token.

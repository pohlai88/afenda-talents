# Decisions

Deviations from `afenda-talents-mvp-build-spec.md`, and choices the spec left open.
Each entry says what was decided, why, and — where it matters — what the rejected
alternative was, so that a later reader does not "fix" a deliberate choice.

Full reasoning: [docs/superpowers/specs/2026-08-04-afenda-talents-architecture-design.md](docs/superpowers/specs/2026-08-04-afenda-talents-architecture-design.md)

---

## D1 — Postgres on Neon, not SQLite

**Spec §2 and §3** specify SQLite via Prisma, with Vercel + Turso as a fallback.

Deployment target is Vercel with Neon Postgres. `provider = "postgresql"`, with Neon's
pooled endpoint in `DATABASE_URL` and the direct endpoint in `DIRECT_URL`. Prisma Migrate
issues DDL and advisory locks that PgBouncer's transaction pooling cannot carry, so
migrations must bypass the pooler; omitting `directUrl` produces migration failures that
present as network faults.

Consequence: spec §2's reasoning ("a file is the correct amount of database here") no longer
applies, and the Phase 8 Dockerfile is not built.

## D2 — `Json` columns instead of stringified JSON

**Spec §3** stores `Result.dimensionScores` and `Result.validityFlags` as `String`, because
"SQLite has no native JSON column in Prisma."

Postgres does. Both are `Json`. This removes every `JSON.parse` at the boundary and the class
of bugs that comes with them. Zod still validates the shape on write, because a `Json` column
accepts anything.

## D3 — Rate limiting in Postgres, counting failures only

**Spec §6** says "in-memory Map is fine." On Vercel each lambda instance holds its own Map,
so a 5-per-15-minutes limit becomes 5-per-instance and degrades as Vercel scales out.

`LoginAttempt` table instead. Rows are written **on failure only** — writing on every attempt
would lock out an admin who legitimately logs in five times in an afternoon — and a successful
login deletes that IP's rows, so the counter measures a run of failures rather than lifetime
usage. Rows older than an hour are pruned opportunistically; no cron.

Redis/Upstash was rejected: spec §12 bans Redis, and the database is already on every request
path.

## D4 — `ADMIN_PASSWORD` must be at least 24 characters

Per-IP limiting does not stop a distributed attempt against one static password behind one
public URL. The real defence is entropy, so `lib/env.ts` rejects a short `ADMIN_PASSWORD` at
boot alongside the existing spec §9 checks. A global cross-IP failure counter was considered
and rejected as more moving parts for less protection.

## D5 — `totalSeconds` is summed, not wall-clocked

**Spec §5** defines `rushed` as `totalSeconds < 240`; **spec §15 step 3** mandates a flow where
the candidate closes the browser halfway and returns later. Wall-clock elapsed time would make
every candidate who takes that break record hours, rendering the flag unreachable for exactly
the population it exists to detect. The two requirements silently contradicted each other.

`totalSeconds = Σ min(msOnItem, 60_000) / 1000`. The per-item clamp stops an idle tab from
inflating the total.

## D6 — Timing is disclosed as self-reported

`msOnItem` is measured in the browser and posted by the client, so it is trivially forgeable.
This is acceptable — spec §13.8 guarantees flags never gate anything — but HR-facing copy must
not imply the server observed it. The `rushed` chip reads "self-reported time on task was under
4 minutes."

`Result.serverWindowSeconds` stores `max(Response.updatedAt) − min(Response.updatedAt)` as a
server-truthed figure shown beside it. Nothing reads it in the MVP; it exists so both numbers
are visible and so a later version has the history without a migration.

## D7 — The request gate stays coarse (deliberate, not a limitation)

`proxy()` verifies the JWT signature and expiry only. Every handler re-reads the candidate row
to check status and expiry.

**This is not because the gate cannot reach the database.** On Next 16, `proxy` runs on the
Node.js runtime, so it could query Prisma directly. Two reasons it does not:

1. The handler must re-check regardless — a cookie proves only that this browser passed the
   token check within the last four hours, not that the candidate is still permitted to
   proceed. A full check in the gate would duplicate that query on every matched request.
2. A gate that looks authoritative invites handlers to skip their own checks. A visibly
   partial gate cannot be leaned on. That is the point.

This is a choice, not a platform constraint. Do not "fix" it by moving authorisation into
`proxy.ts`.

Relatedly: App Router route handlers already default to the Node runtime. The explicit
`export const runtime = 'nodejs'` in Prisma-touching handlers is documentation of intent.

## D8 — Path token and cookie authenticate different things, and must agree

The path token authenticates **page renders** (`/a/[token]*`). The cookie authenticates
**`/api/candidate/*` calls**, which carry no token in their path. On every `/a/[token]/*`
render the candidate resolved from the token hash must equal the cookie's `candidateId`, or
the request 404s exactly as a bad token does. This closes the shared-device case that spec
§13.6 tells us to expect.

Rejected: dropping the cookie and putting the raw token in POST bodies. Request bodies land in
platform logs, and spec §13.2 permits raw tokens in exactly two places — the email body and
the URL.

## D9 — Retention needs a mechanism, and audit rows must hold no identities

**Spec §13.7** requires the consent text to state a retention period; nothing in the spec ever
deletes data. With a SQLite file you could delete the file. With managed Postgres you cannot.

`RETENTION_DAYS` is interpolated directly into the consent text so the stated and configured
periods cannot drift. Two admin actions, each behind a typed confirmation and each audited:
delete one candidate (PDPA erasure right) and purge all candidate data (end of round).

Purge is only honest if nothing identifying survives it, and `AuditEvent` rows are retained as
proof the purge happened. Hence the **ninth invariant**: `AuditEvent` never stores a name or an
email — `subjectId` holds an id, `meta` holds non-identifying data only. With spec §13.2 this
reduces to one rule: audit rows carry identifiers, never identities or secrets.

## D10 — Playwright covers spec §15; unit tests widen to `status` and `tokens`

Spec §11 mandates Vitest for `lib/scoring.ts` only, while spec §15's nine acceptance criteria
are entirely manual. The riskiest behaviours — resume-after-refresh, revoke, resend, and the
auth boundaries — are the most tedious to re-verify by hand.

Playwright specs accrete per phase rather than landing as one lump, and run against a dedicated
Neon `test` branch reset with `prisma migrate reset`. Unit tests widen to `lib/status.ts` and
`lib/tokens.ts`, both pure and both easy to get subtly wrong.

## D11 — Neon autosuspend is a Phase 8 verification item

Neon's free tier autosuspends after inactivity, so the first candidate to open a link after a
quiet period waits on a cold start — on a phone, on mobile data, looking at a blank screen.
Phase 8 measures it. If it is bad, the choice is a paid Neon tier or knowing acceptance. It
should not be discovered by a candidate.

## D12 — No separate reminder email

**Spec §8** lists a manually-sent reminder as a third template. Because only `sha256(token)` is
stored, the server cannot reconstruct a candidate's original link, so any reminder containing a
usable link *is* a resend with a new token.

Rather than ship two buttons that do the same thing while one pretends not to, "Resend" is the
single action, and its email says the link may have changed. The reminder template is not built.

## D13 — Next.js 16.3, not the spec's Next.js 15

**Spec §2** pins Next.js 15. `create-next-app@latest` installs 16.3, which is current stable,
is what Vercel optimises for, and has the longer security-support horizon. Staying on it was a
deliberate choice made when the scaffold surfaced the mismatch.

Consequences already absorbed:

- `middleware.ts` becomes `proxy.ts`, exporting `proxy()` instead of `middleware()`. The
  runtime is Node and is not configurable — see D7, whose reasoning changed as a result.
- `next lint` is removed; the `lint` script calls `eslint` directly, and `next build` no longer
  lints. The `eslint` key in `next.config.ts` is no longer supported.
- Turbopack is the default bundler.
- Async request APIs (`params`, `searchParams`, `cookies()`, `headers()`) are Promise-based.
  The plan was already written this way, so no change was needed.

`AGENTS.md` carries a managed block, rewritten by `next dev`, pointing at version-matched docs
in `node_modules/next/dist/docs/`. Read those before writing Next-specific code rather than
relying on recall — this version diverges from training data in ways that are easy to miss.

## D14 — Local development database is embedded-postgres, not `prisma dev`

Until the Neon project exists, local dev and e2e need a Postgres. `prisma dev` (PGlite behind
a connection proxy) was tried first and repeatedly entered a state where it reset every new
connection while claiming to be running — reproduced outside the test suite with five
consecutive raw-client failures. Real PostgreSQL binaries via `embedded-postgres` replaced it:
`pnpm db:local` serves `afenda` (dev) and `afenda_test` (e2e) on port 54329, data in `.pgdata/`.

This is scaffolding, not architecture: production remains Neon (D1), and `.env`/`.env.test`
swap to the Neon pooled/direct pairs when that project is created.

## D15 — Homegrown two-role RBAC, not Neon Auth, and candidates are not users

The single-admin model (spec §1, §12) was outgrown: several managers need to see candidates.
Neon Auth (Managed Better Auth) was evaluated — live on the project, branch-aware — but the
user chose a smaller build: a `User` table with scrypt password hashes (node:crypto, no new
dependency) and two roles. **ADMIN** acts (invite, resend, revoke, delete, purge, export,
manage users); **VIEWER** reads (dashboard, profiles). The session JWT carries
`{ userId, role }` in the same `afenda_admin` cookie; the proxy gate admits either role and
every mutating handler re-checks with `requireAdmin()` — consistent with D7's coarse gate.

Deliberate exclusions: **candidates are not a role** — their emailed token remains their only
credential, and the candidate auth file is untouched (invariant 7 holds). No self-service
password reset — an admin regenerates a temporary password shown exactly once. No per-manager
candidate scoping yet, but `Candidate.invitedById` records the inviter so scoping later is a
WHERE clause, not a migration. The env `ADMIN_EMAIL`/`ADMIN_PASSWORD` now bootstrap the first
ADMIN account at seed time instead of being the login credential themselves. Audit `actor`
holds the user id — never an email (invariant 6).

## D16 — Forced first-sign-in password change, email preview, confirm dialogs

Three UX gaps surfaced by review, all inside D15's boundaries (hiring users only — candidates
still have no accounts, invariant 7 untouched):

- **`User.mustChangePassword`** is set whenever a password was issued by someone else
  (account creation, admin reset). The admin shell layout redirects to
  `/admin/change-password` (outside the `(shell)` route group, like login) until the holder
  replaces it via `POST /api/admin/password` — current password proven, new one ≥ 12 chars,
  same IP rate limit as login, audited as `user.password_changed` (id only). A voluntary
  change lives behind the same page from the sidebar footer. This is not the spec's excluded
  "candidate password reset"; it hardens D15's temp-password hand-over.
- **Email preview**: `lib/email.ts` exports its HTML builders; `/admin/invite` renders both
  templates with sample data in a dialog. The preview and the sender share one source of
  truth, and no token — real or fake — is minted for it.
- **Confirm dialogs** on Revoke invitation, Reset password, and Remove account. The purge
  keeps its stronger type-the-phrase gate. Two shell regressions fixed in passing: nested
  `<main>` landmarks, and the sidebar printing on candidate profiles (`print:hidden`).

## D17 — The UI/UX requirements document becomes authoritative; §12 narrowly superseded

`docs/afenda-talents-complete-ui-ux-requirements.md` is promoted from Proposed to authoritative for
presentation, information architecture, and visual system. Where it and the MVP build spec disagree
on how the product *looks and is organised*, it wins; the build spec continues to govern behaviour,
data, and security.

One prohibition is superseded, narrowly. Spec §12's "Analytics or dashboards beyond the status
counts" no longer forbids **a read-only operational overview derived entirely from data the system
already writes** — current-status distribution, an attention queue computed from `sentAt`,
`openedAt`, `expiresAt`, `Response.updatedAt` and existing audit rows, recent completions, and a
human-readable activity feed.

D17 authorises nothing else. Still prohibited, unchanged: candidate ranking; comparative analytics
or benchmarking; configurable or user-built dashboards; any new tracking event or schema column
added to feed a dashboard; automated or scheduled reminders; hiring recommendations; and composite
or overall scores. The overview may order rows by operational urgency — never by any property of a
candidate's answers.

Two further calls recorded with it:

- **Palette.** The authenticated application adopts Executive Navy, Governance Teal, Registry Blue
  and Cool Porcelain as its operational system. Compass Gold is demoted to a brand-signature accent
  for lockups only — never the primary button, progress, status, or selection colour. The landing
  page's scoped `.af` palette is untouched, because a poster may legitimately differ from product UI.
- **Deferred pending approval.** Dimension narrative interpretations and the hiring conversation
  guide are not built. The instrument was never validated to support narrative interpretation, and
  the requirements document itself makes both contingent on explicit approval.

Design: `docs/superpowers/specs/2026-08-05-afenda-talents-priority-1-facade-design.md`.

## D18 — Configurable assessments, thin hiring rounds, assignment-scoped candidates

**Spec §1 / §12** assumed one seeded instrument, no item editor, and one implicit hiring round.
That product direction is intentionally superseded.

Afenda Talents uses a **document-on-version** model: `Assessment` (mutable `draftDocument`) and
immutable `AssessmentVersion.document` snapshots; thin `HiringRound` (name + published version +
status); and `CandidateAssignment` as the invite/completion unit. The same email may hold many
assignments. Round assessment version is editable only while `DRAFT` and locks on `DRAFT→OPEN`.
Invitations require an `OPEN` round. Each assignment stores its own `assessmentVersionId` (copied
from the round at creation) so scoring and history do not depend on later round edits.

Candidate sessions claim `{ assignmentId }`. The cookie name may remain `afenda_candidate`; helpers
and claim vocabulary must not pretend the id is a person id. Scoring and response-context rules are
**version-driven**; the former global `Item` catalog is not runtime authority. The existing 34-item
Afenda behavioural assessment becomes a protected system template and published version 1. Migration
is expand → backfill → cutover → contract; `prisma migrate deploy` does not read `instrument.json`.

Delivery 1 ships the model, migration, version-driven scoring, thin rounds, and read-only assessment
surfaces. Delivery 2 ships the visual builder (Likert, short/long text, information items) without
replacing the schema.

This decision does **not** authorise: public or anonymous forms; candidate ranking; composite or
overall scores; automatic hiring recommendations; claims that organisation-authored assessments are
psychometrically validated; choice/multi/ranking/branching through Delivery 2; a response-context
rule editor UI through Delivery 2; an Assessment Designer role; or a separate Templates product nav
in Delivery 1.

Design: `docs/superpowers/specs/2026-08-05-configurable-assessments-design.md`.

## D20 — A due item is identified by line, date and period label

`ObligationDueItem` was unique on `(lineId, dueDate)`, which allowed only one due item
per line per date. Real administration produces more: a split invoice, a partial billing
plus a top-up, two vendors invoicing one line on one day. The key now includes
`periodLabel`.

The label was chosen as the discriminator because it is server-defaulted from the due
date, so an accidental resubmit still collides and is still rejected, while a deliberate
second item must be named — which also makes the two rows readable wherever due items are
listed. Obligation-level same-date items across different lines already worked and were
not changed.

Design: `docs/superpowers/specs/2026-08-13-multiple-due-items-per-date-design.md`.

## D21 — Corporate corrects and stands down, it never deletes

Sites, counterparty contacts, service coverage, obligation parties and obligation-site
links were create-only: a mistyped address or a wrongly attached site was permanent.
Each now has a `PATCH` endpoint taking `UPDATE` to correct fields or `SET_ACTIVE` to
stand the record down.

No `DELETE` handler was added, because Corporate has never had one and an administration
record that vanishes takes its history with it. `AdministrativeObligationParty` and
`AdministrativeObligationSite` gained an `isActive` column so all five stand down the
same way; the site link previously had no removal affordance at all.

**Partial-update semantics.** The `UPDATE` action is a genuine partial update: omitting
an optional field in the request leaves the stored value untouched, while sending `null`
or `""` clears it to null. This contract matters because naive implementations null
omitted fields, which would silently destroy data. Every handler uses the pattern
`field === undefined ? undefined : value`, and string fields are passed through
`cleanOptionalString()` which converts empty and whitespace-only strings to null, so the
caller's explicit intent to clear a field is honoured. Exception: a site's reference
`code` is `NOT NULL` and unique, so blank, null and omitted are all treated as "keep the
existing code" — it can never be cleared, and a blank field on the form means "leave the
generated one alone".

Identity fields are not editable. The counterparty on a coverage row, the counterparty
and role code on an obligation party, and the site on an obligation link cannot be
changed. For `AdministrativeServiceCoverage` this is a policy choice — a coverage
relationship is defined by its endpoints and cannot be edited in place. For the two link
tables, the constraint is structural: `AdministrativeObligationParty` is keyed
`@@id([obligationId, counterpartyId, roleCode])` and `AdministrativeObligationSite` is
keyed `@@id([obligationId, siteId])`, so those columns are the composite primary key and
cannot be updated. To fix an attachment in either case, stand the row down and create
the correct one.

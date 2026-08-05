# Afenda Talents

Pre-employment self-assessment for a single hiring round. Candidates are invited by email; hiring managers review dimension profiles — no pass/fail, no ranking, no overall score.

| Surface | Who | Entry |
|---------|-----|-------|
| **Admin** | Hiring users (`ADMIN` or `VIEWER`) | `/admin/login` |
| **Candidate** | Invited people only | `/a/{token}` |

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Prisma 7** + **PostgreSQL** (Neon in production; embedded Postgres locally)
- **shadcn/ui** · **Tailwind CSS 4**
- **Vitest** (unit) · **Playwright** (e2e) · **Resend** (email)

## Documentation

| Document | Purpose |
|----------|---------|
| [`afenda-talents-mvp-build-spec.md`](afenda-talents-mvp-build-spec.md) | Requirements and build order |
| [`docs/superpowers/specs/2026-08-04-afenda-talents-architecture-design.md`](docs/superpowers/specs/2026-08-04-afenda-talents-architecture-design.md) | Architecture (wins over spec on conflict) |
| [`DECISIONS.md`](DECISIONS.md) | Deviations and rationale |
| [`AGENTS.md`](AGENTS.md) | Commands and invariants for contributors |

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 10 (`corepack enable` if needed)

## Local development

### 1. Install and configure

```bash
pnpm install
cp .env.example .env
```

For local Postgres (recommended), set both URLs to the embedded database:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/afenda"
DIRECT_URL="postgresql://postgres:postgres@localhost:54329/afenda"
```

Fill in `APP_SECRET` (32+ random bytes) and `ADMIN_PASSWORD` (24+ characters). See `.env.example` for generators.

### 2. Start the database

In a separate terminal, leave this running:

```bash
pnpm db:local
```

Embedded Postgres on port **54329** with databases `afenda` (dev) and `afenda_test` (e2e). Data persists in `.pgdata/`. See [DECISIONS.md D14](DECISIONS.md).

### 3. Migrate, seed, and run

```bash
pnpm db:deploy
pnpm db:seed     # expect: "Seeded Core v1 assessment and OPEN hiring round."
pnpm dev
```

Open [http://localhost:3000/admin/login](http://localhost:3000/admin/login). The seed creates an admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.

### Email in development

With `RESEND_API_KEY` empty, every email prints to stdout — including invitation links. That is the intended local workflow.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build (`prisma generate` + `next build`) |
| `pnpm start` | Serve production build |
| `pnpm db:local` | Embedded Postgres on `:54329` |
| `pnpm db:migrate` | Create/apply migrations (dev) |
| `pnpm db:deploy` | Apply migrations (CI/production) |
| `pnpm db:seed` | Seed instrument, hiring round, and admin user |
| `pnpm db:studio` | Prisma Studio |
| `pnpm test` | Vitest unit tests (no database) |
| `pnpm test:e2e` | Playwright against `.env.test` |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript (`tsc --noEmit`) |

## Quality checks

Run before declaring work done:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm exec node scripts/check-invariants.mjs
```

The invariant checker is pure Node (Windows-friendly). It enforces auth separation, status-machine boundaries, and other build-spec rules.

## Project layout

```
src/
├── app/
│   ├── a/[token]/          # Candidate flow (consent → assessment → done)
│   ├── admin/              # Hiring dashboard (overview, candidates, invite, …)
│   └── api/                # Route handlers (admin + candidate)
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── overview/           # Dashboard widgets
│   ├── candidates/         # Registry and filters
│   └── assessment-builder/ # Instrument editor
├── lib/
│   ├── auth-admin.ts       # Server-only hiring auth (next/headers)
│   ├── auth-candidate.ts   # Server-only candidate auth
│   ├── hiring-roles.ts     # Client-safe role constants
│   ├── status-constants.ts # Client-safe status machine
│   ├── status.ts           # Server-only applyStatus()
│   └── scoring.ts          # Pure scoring (no Prisma)
prisma/                     # Schema and migrations
tests/
├── unit/                   # Vitest
└── e2e/                    # Playwright (spec §15)
```

**Client/server boundary:** client components must not import `auth-admin.ts`, `status.ts`, or `db.ts`. Shared types and constants live in `hiring-roles.ts` and `status-constants.ts`.

## End-to-end tests

Copy `.env` to `.env.test`, point both database URLs at `afenda_test`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/afenda_test"
DIRECT_URL="postgresql://postgres:postgres@localhost:54329/afenda_test"
```

Then:

```bash
pnpm db:local   # if not already running
pnpm dotenv -e .env.test -- prisma migrate deploy
pnpm dotenv -e .env.test -- prisma db seed
pnpm test:e2e
```

For CI or Neon, use a dedicated `test` branch connection pair in `.env.test` instead.

## Deploying

Production target is **Vercel** + **Neon Postgres** + **Resend**. No Dockerfile.

### 1. Generate secrets

Both must be generated, never chosen:

```bash
node -e "console.log('APP_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ADMIN_PASSWORD=' + require('crypto').randomBytes(24).toString('base64url'))"
```

`lib/env.ts` refuses an `ADMIN_PASSWORD` under 24 characters at boot ([D4](DECISIONS.md)).

### 2. Neon

Create a project plus a `test` branch. Copy the **pooled** connection string (host contains `-pooler`) into `DATABASE_URL` and the **direct** one into `DIRECT_URL` — migrations fail through the pooler ([D1](DECISIONS.md)). Put the test branch pair in `.env.test`.

### 3. Vercel

Import the repo and set every variable from `.env.example` for Production.

### 4. Resend

Verify the sending domain, set `MAIL_FROM` to an address on it, and set `RESEND_API_KEY`.

### 5. Migrate and seed production

```bash
pnpm dotenv -e .env.production -- prisma migrate deploy
pnpm dotenv -e .env.production -- prisma db seed
```

Expect `Seeded Core v1 assessment and OPEN hiring round.`

### 6. Cold-start check ([D11](DECISIONS.md))

Leave the deployment idle 15 minutes so Neon autosuspends, then open a candidate link on a phone over mobile data and time it. Record under D11. Over ~5 seconds → paid Neon tier, or accept in writing.

### 7. Production smoke test

Walk spec §15 by hand with three real addresses. Playwright covers the same ground; this run proves the real host, database, email provider, and phone work together.

### 8. Verify unauthenticated access is blocked

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/admin
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/api/admin/export
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/api/candidate/submit
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/a/not-a-real-token
```

Expected: redirect to login or 401/307 as appropriate.

## End of round

The consent text promises deletion after `RETENTION_DAYS` days. Honouring it is manual: the dashboard **Delete candidate data** section removes every candidate, response, and result. The audit log keeps an identity-free record that the purge happened.

# Afenda Talents MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an invitation-only pre-employment self-assessment where one HR Manager invites named candidates by email, each completes a 34-item Likert instrument via a one-time link, and the system scores five competency dimensions with response-validity flags.

**Architecture:** One Next.js 15 App Router deployment on Vercel, backed by Neon Postgres via Prisma. Two independent auth mechanisms that never share code: a password-derived JWT cookie for the single admin, and a one-time hashed invitation token for candidates. Scoring is a pure module with no database access, called synchronously inside the submit handler.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Prisma + Neon Postgres, Tailwind CSS + shadcn/ui, `jose` for JWTs, Resend for email (console transport in dev), Zod for validation, Vitest for unit tests, Playwright for end-to-end.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from
`afenda-talents-mvp-build-spec.md` and `docs/superpowers/specs/2026-08-04-afenda-talents-architecture-design.md`.

- Node 20+. Package manager is **pnpm**.
- **No route is reachable without an admin cookie or a valid invitation token.** Verify after every phase.
- **Raw invitation tokens exist in exactly two places: the email body and the URL.** Never in the database, logs, audit rows, or error messages. Only `sha256(token)` is stored.
- **`status` changes only through `lib/status.ts`.** Legal transitions: `DRAFT→SENT`; `SENT→STARTED|EXPIRED|REVOKED`; `STARTED→SUBMITTED|EXPIRED|REVOKED`; `SUBMITTED→SCORED`; `SCORED` terminal; `EXPIRED|REVOKED→SENT`. Anything else throws.
- **Every API handler validates its body with Zod before touching the database.**
- **`lib/scoring.ts` imports nothing from Prisma** and never mutates `Response` rows. Recomputing a `Result` must always be possible from the responses alone.
- **`AuditEvent` never stores a name or an email** — `subjectId` holds an id, `meta` holds non-identifying data only.
- **Two auth systems, never mixed:** `lib/auth-admin.ts` and `lib/auth-candidate.ts` are separate files, share no helper, and no handler imports both.
- **Middleware verifies JWT signature and expiry only.** It cannot reach Prisma. Every handler and every `/a/[token]/*` page re-reads the candidate row and re-checks status and expiry.
- **The candidate UI is mobile-first.** Assume a mid-range Android phone on mobile data.
- **Consent is captured before the first item is shown**, and names what is collected, who sees it, and how long it is kept (PDPA 2010 obligation).
- **No pass/fail, no ranking, no single overall number** anywhere in the UI or the export.
- Before adding any feature, check spec §12 Non-goals. If it seems necessary anyway, record it in `DECISIONS.md` and move on.
- Likert scale is 1–5 where 1 = strongly disagree, 5 = strongly agree. Item presentation order is **fixed**, never randomised.

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | Data model, Postgres, pooled + direct URLs |
| `prisma/seed.ts` | Idempotent load of the 34 instrument items |
| `data/instrument.json` | The instrument — item text, dimension, order, reverse/validity flags |
| `src/lib/env.ts` | Zod-validated environment, fails fast at boot |
| `src/lib/db.ts` | `PrismaClient` singleton |
| `src/lib/scoring.ts` | Pure scoring and validity flags. No Prisma. |
| `src/lib/status.ts` | Status transition table; the only writer of `Candidate.status` |
| `src/lib/tokens.ts` | Token generation, hashing, invite URL, expiry |
| `src/lib/rate-limit.ts` | Failure-counting login limiter backed by `LoginAttempt` |
| `src/lib/auth-admin.ts` | Admin password check, admin JWT mint/verify. Admin only. |
| `src/lib/auth-candidate.ts` | Candidate JWT mint/verify, token→candidate resolution. Candidate only. |
| `src/lib/audit.ts` | `AuditEvent` writer, with a PII guard |
| `src/lib/email.ts` | Three templates + Resend/console transports |
| `proxy.ts` | Coarse signature gate for `/admin/*`, `/api/admin/*`, `/api/candidate/*` |
| `src/app/api/**` | Route handlers, one per spec §7 row |
| `src/app/admin/**` | Admin pages |
| `src/app/a/[token]/**` | Candidate pages |
| `tests/unit/*.test.ts` | Vitest over the pure modules |
| `tests/e2e/*.spec.ts` | Playwright over spec §15 |

---

## Task 1: Project scaffold and test harnesses

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `components.json`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `.gitignore`

**Interfaces:**
- Produces: `pnpm dev`, `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck` scripts that all later tasks rely on.

- [ ] **Step 1: Scaffold the app**

```bash
pnpm dlx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-pnpm
```

Answer "no" to any prompt about overwriting `README.md` if asked; keep existing files.

- [ ] **Step 2: Add dependencies**

```bash
pnpm add @prisma/client zod jose resend
pnpm add -D prisma vitest @vitejs/plugin-react @playwright/test tsx dotenv-cli
pnpm exec playwright install chromium
```

- [ ] **Step 3: Initialise shadcn/ui**

```bash
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button input label card table badge textarea dialog
```

- [ ] **Step 4: Write `vitest.config.ts`**

Unit tests must run without a database and without a real `.env`, so the config supplies
valid env values directly.

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      DIRECT_URL: "postgresql://test:test@localhost:5432/test",
      APP_URL: "http://localhost:3000",
      APP_SECRET: "0123456789abcdef0123456789abcdef",
      ADMIN_EMAIL: "hr@example.com",
      ADMIN_PASSWORD: "unit-test-password-24-chars-long",
      MAIL_FROM: "Afenda Talents <noreply@example.com>",
      INVITE_TTL_DAYS: "14",
      RETENTION_DAYS: "180",
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

- [ ] **Step 5: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 5"] } }],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

`workers: 1` and `fullyParallel: false` are deliberate — the tests share one database and one
admin account, so parallel runs would interfere.

- [ ] **Step 6: Add scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "dotenv -e .env.test -- playwright test",
    "db:seed": "prisma db seed"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
```

- [ ] **Step 7: Write `.env.example`**

```
DATABASE_URL="postgresql://user:pass@host-pooler.neon.tech/afenda?sslmode=require"
DIRECT_URL="postgresql://user:pass@host.neon.tech/afenda?sslmode=require"
APP_URL="http://localhost:3000"
APP_SECRET="generate-32-bytes-of-random"
ADMIN_EMAIL="hr@example.com"
ADMIN_PASSWORD="generate-at-least-24-characters"
RESEND_API_KEY=""
MAIL_FROM="Afenda Talents <noreply@example.com>"
INVITE_TTL_DAYS="14"
RETENTION_DAYS="180"
```

- [ ] **Step 8: Ensure `.gitignore` covers secrets and artefacts**

Append if missing:

```
.env
.env.local
.env.test
/test-results/
/playwright-report/
```

- [ ] **Step 9: Verify the harness runs**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass with no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and Playwright harnesses"
```

---

## Task 2: Database schema and Neon connection

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`

**Interfaces:**
- Produces: `db` — the shared `PrismaClient`. Models `Candidate`, `Item`, `Response`, `Result`, `AuditEvent`, `LoginAttempt`.

- [ ] **Step 1: Create the Neon project and both connection strings**

In the Neon console create a project named `afenda-talents`, then create a second branch named
`test`. From the connection details panel copy:
- the **pooled** connection string (host contains `-pooler`) into `DATABASE_URL` in `.env`
- the **direct** connection string into `DIRECT_URL` in `.env`

Repeat with the `test` branch's strings into a new `.env.test`, and set the remaining variables
in `.env.test` to the same values as `.env`.

The split is not optional. Prisma Migrate issues DDL and takes advisory locks that PgBouncer's
transaction pooling cannot carry; pointing migrations at the pooler fails in ways that look
like network faults.

- [ ] **Step 2: Write `prisma/schema.prisma`**

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Candidate {
  id           String     @id @default(cuid())
  email        String     @unique
  fullName     String
  status       String     @default("DRAFT")
  tokenHash    String?    @unique
  expiresAt    DateTime?
  sentAt       DateTime?
  openedAt     DateTime?
  consentedAt  DateTime?
  startedAt    DateTime?
  submittedAt  DateTime?
  createdAt    DateTime   @default(now())
  responses    Response[]
  result       Result?
}

model Item {
  id            String     @id
  dimension     String
  order         Int
  text          String
  reverseScored Boolean    @default(false)
  isValidity    Boolean    @default(false)
  responses     Response[]
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
  id                  String    @id @default(cuid())
  candidateId         String    @unique
  dimensionScores     Json
  validityFlags       Json
  totalSeconds        Int
  serverWindowSeconds Int
  computedAt          DateTime  @default(now())
  candidate           Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
}

model AuditEvent {
  id        String   @id @default(cuid())
  actor     String
  action    String
  subjectId String?
  meta      Json?
  createdAt DateTime @default(now())
}

model LoginAttempt {
  id        String   @id @default(cuid())
  ip        String
  createdAt DateTime @default(now())

  @@index([ip, createdAt])
}
```

- [ ] **Step 3: Write `src/lib/db.ts`**

The singleton matters on serverless: without it every warm invocation opens a new connection
pool and Neon's connection limit is reached quickly.

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 4: Run the migration**

Run: `pnpm prisma migrate dev --name init`
Expected: migration applies, `prisma/migrations/*/migration.sql` is created, client generates.

- [ ] **Step 5: Verify the tables exist**

Run: `pnpm prisma studio` (or query Neon's SQL editor)
Expected: six tables — `Candidate`, `Item`, `Response`, `Result`, `AuditEvent`, `LoginAttempt`.

- [ ] **Step 6: Commit**

```bash
git add prisma src/lib/db.ts
git commit -m "feat: add Postgres schema and Prisma client singleton"
```

---

## Task 3: The instrument and an idempotent seed

**Files:**
- Create: `data/instrument.json`, `prisma/seed.ts`
- Test: verified by running the seed twice

**Interfaces:**
- Produces: 34 `Item` rows with ids `WER-1`…`WER-6`, `COM-1`…`COM-6`, `PSL-1`…`PSL-6`, `ADR-1`…`ADR-6`, `INA-1`…`INA-6`, `VAL-1`…`VAL-4`, and `order` 1–34 in that sequence.

- [ ] **Step 1: Write `data/instrument.json`**

Order is the presentation order and is fixed. Reverse-scored and validity items are marked
exactly as spec §4 lists them.

```json
{
  "items": [
    { "id": "WER-1", "dimension": "WER", "order": 1, "text": "I complete tasks by the deadline I commit to.", "reverseScored": false, "isValidity": false },
    { "id": "WER-2", "dimension": "WER", "order": 2, "text": "I keep track of my responsibilities without being reminded.", "reverseScored": false, "isValidity": false },
    { "id": "WER-3", "dimension": "WER", "order": 3, "text": "I often leave tasks unfinished when they become tedious.", "reverseScored": true, "isValidity": false },
    { "id": "WER-4", "dimension": "WER", "order": 4, "text": "I arrive prepared for meetings and work sessions.", "reverseScored": false, "isValidity": false },
    { "id": "WER-5", "dimension": "WER", "order": 5, "text": "I follow through on commitments even when no one is checking.", "reverseScored": false, "isValidity": false },
    { "id": "WER-6", "dimension": "WER", "order": 6, "text": "I let small tasks pile up before dealing with them.", "reverseScored": true, "isValidity": false },

    { "id": "COM-1", "dimension": "COM", "order": 7, "text": "I check that others have understood what I meant.", "reverseScored": false, "isValidity": false },
    { "id": "COM-2", "dimension": "COM", "order": 8, "text": "I ask questions when instructions are unclear.", "reverseScored": false, "isValidity": false },
    { "id": "COM-3", "dimension": "COM", "order": 9, "text": "I find it difficult to give feedback to colleagues.", "reverseScored": true, "isValidity": false },
    { "id": "COM-4", "dimension": "COM", "order": 10, "text": "I adjust how I explain things depending on who I am talking to.", "reverseScored": false, "isValidity": false },
    { "id": "COM-5", "dimension": "COM", "order": 11, "text": "I listen fully before forming a response.", "reverseScored": false, "isValidity": false },
    { "id": "COM-6", "dimension": "COM", "order": 12, "text": "I avoid raising concerns in group settings.", "reverseScored": true, "isValidity": false },

    { "id": "PSL-1", "dimension": "PSL", "order": 13, "text": "I break unfamiliar problems into smaller parts.", "reverseScored": false, "isValidity": false },
    { "id": "PSL-2", "dimension": "PSL", "order": 14, "text": "I look for the underlying cause rather than the quick fix.", "reverseScored": false, "isValidity": false },
    { "id": "PSL-3", "dimension": "PSL", "order": 15, "text": "I wait for someone else to suggest an approach.", "reverseScored": true, "isValidity": false },
    { "id": "PSL-4", "dimension": "PSL", "order": 16, "text": "I seek out skills I do not yet have.", "reverseScored": false, "isValidity": false },
    { "id": "PSL-5", "dimension": "PSL", "order": 17, "text": "I test my assumptions before committing to a solution.", "reverseScored": false, "isValidity": false },
    { "id": "PSL-6", "dimension": "PSL", "order": 18, "text": "I find it hard to change my approach once I have started.", "reverseScored": true, "isValidity": false },

    { "id": "ADR-1", "dimension": "ADR", "order": 19, "text": "I stay effective when priorities change at short notice.", "reverseScored": false, "isValidity": false },
    { "id": "ADR-2", "dimension": "ADR", "order": 20, "text": "I recover quickly after setbacks at work.", "reverseScored": false, "isValidity": false },
    { "id": "ADR-3", "dimension": "ADR", "order": 21, "text": "Unexpected changes leave me unsettled for a long time.", "reverseScored": true, "isValidity": false },
    { "id": "ADR-4", "dimension": "ADR", "order": 22, "text": "I look for what I can control in difficult situations.", "reverseScored": false, "isValidity": false },
    { "id": "ADR-5", "dimension": "ADR", "order": 23, "text": "I am comfortable working without complete information.", "reverseScored": false, "isValidity": false },
    { "id": "ADR-6", "dimension": "ADR", "order": 24, "text": "I struggle to perform when under time pressure.", "reverseScored": true, "isValidity": false },

    { "id": "INA-1", "dimension": "INA", "order": 25, "text": "I admit mistakes as soon as I notice them.", "reverseScored": false, "isValidity": false },
    { "id": "INA-2", "dimension": "INA", "order": 26, "text": "I raise problems even when it is uncomfortable.", "reverseScored": false, "isValidity": false },
    { "id": "INA-3", "dimension": "INA", "order": 27, "text": "I look for reasons outside myself when things go wrong.", "reverseScored": true, "isValidity": false },
    { "id": "INA-4", "dimension": "INA", "order": 28, "text": "I keep confidential information confidential.", "reverseScored": false, "isValidity": false },
    { "id": "INA-5", "dimension": "INA", "order": 29, "text": "I take responsibility for outcomes in my area of work.", "reverseScored": false, "isValidity": false },
    { "id": "INA-6", "dimension": "INA", "order": 30, "text": "I bend rules when it makes the work easier.", "reverseScored": true, "isValidity": false },

    { "id": "VAL-1", "dimension": "VAL", "order": 31, "text": "I have never been irritated by a colleague.", "reverseScored": false, "isValidity": true },
    { "id": "VAL-2", "dimension": "VAL", "order": 32, "text": "I have never made a mistake I regretted at work.", "reverseScored": false, "isValidity": true },
    { "id": "VAL-3", "dimension": "VAL", "order": 33, "text": "I meet the deadlines I agree to.", "reverseScored": false, "isValidity": true },
    { "id": "VAL-4", "dimension": "VAL", "order": 34, "text": "I own up to my errors quickly.", "reverseScored": false, "isValidity": true }
  ]
}
```

- [ ] **Step 2: Write `prisma/seed.ts`**

`upsert` keyed on the stable item id is what makes re-running safe.

```ts
import { PrismaClient } from "@prisma/client";
import instrument from "../data/instrument.json";

const db = new PrismaClient();

async function main() {
  for (const item of instrument.items) {
    await db.item.upsert({
      where: { id: item.id },
      update: {
        dimension: item.dimension,
        order: item.order,
        text: item.text,
        reverseScored: item.reverseScored,
        isValidity: item.isValidity,
      },
      create: item,
    });
  }
  const count = await db.item.count();
  console.log(`Seeded instrument. Item count: ${count}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 3: Enable JSON imports**

In `tsconfig.json` ensure `compilerOptions` contains `"resolveJsonModule": true`.

- [ ] **Step 4: Seed once and verify the count**

Run: `pnpm db:seed`
Expected: `Seeded instrument. Item count: 34`

- [ ] **Step 5: Seed again and verify idempotency**

Run: `pnpm db:seed`
Expected: `Seeded instrument. Item count: 34` — still 34, not 68.

This is the spec §11 Phase 1 "Done when" gate. Paste the output; do not assert it from memory.

- [ ] **Step 6: Commit**

```bash
git add data prisma tsconfig.json
git commit -m "feat: add instrument data and idempotent seed"
```

---

## Task 4: Scoring engine (pure)

**Files:**
- Create: `src/lib/scoring.ts`
- Test: `tests/unit/scoring.test.ts`

**Interfaces:**
- Produces:
  - `type Band = "Developing" | "Effective" | "Strong"`
  - `type ItemDef = { id: string; dimension: string; order: number; reverseScored: boolean; isValidity: boolean }`
  - `type RawResponse = { itemId: string; value: number; msOnItem: number }`
  - `type Scored = { dimensions: { code: string; raw: number; scaled: number; band: Band }[]; flags: { code: string; triggered: boolean; reason: string }[]; totalSeconds: number }`
  - `score(items: ItemDef[], responses: RawResponse[]): Scored`
  - `itemScore(value: number, reverseScored: boolean): number`
  - `scaleDimension(raw: number): number`
  - `bandFor(scaled: number): Band`
  - `totalSecondsFrom(responses: RawResponse[]): number`
  - `COMPETENCY_CODES`, `MS_PER_ITEM_CAP`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/scoring.test.ts`. The helper builds a full 34-item response set so each
test can vary one thing.

```ts
import { describe, it, expect } from "vitest";
import instrument from "../../data/instrument.json";
import {
  score, itemScore, scaleDimension, bandFor, totalSecondsFrom,
  type ItemDef, type RawResponse,
} from "@/lib/scoring";

const items = instrument.items as ItemDef[];

function responses(overrides: Record<string, number> = {}, msOnItem = 20_000): RawResponse[] {
  return items.map((i) => ({
    itemId: i.id,
    value: overrides[i.id] ?? 3,
    msOnItem,
  }));
}

describe("itemScore", () => {
  it("returns the value unchanged for a normal item", () => {
    expect(itemScore(4, false)).toBe(4);
  });

  it("inverts a reverse-scored item around 6", () => {
    expect(itemScore(4, true)).toBe(2);
    expect(itemScore(1, true)).toBe(5);
  });
});

describe("scaleDimension", () => {
  it("maps the raw range 6..30 onto 0..100", () => {
    expect(scaleDimension(6)).toBe(0);
    expect(scaleDimension(18)).toBe(50);
    expect(scaleDimension(30)).toBe(100);
  });
});

describe("bandFor", () => {
  it("places 44 in Developing and 45 in Effective", () => {
    expect(bandFor(44)).toBe("Developing");
    expect(bandFor(45)).toBe("Effective");
  });

  it("places 69 in Effective and 70 in Strong", () => {
    expect(bandFor(69)).toBe("Effective");
    expect(bandFor(70)).toBe("Strong");
  });
});

describe("totalSecondsFrom", () => {
  it("sums per-item milliseconds", () => {
    expect(totalSecondsFrom([
      { itemId: "a", value: 3, msOnItem: 1_000 },
      { itemId: "b", value: 3, msOnItem: 2_000 },
    ])).toBe(3);
  });

  it("clamps each item at 60 seconds so an idle tab cannot inflate the total", () => {
    expect(totalSecondsFrom([
      { itemId: "a", value: 3, msOnItem: 9_000_000 },
      { itemId: "b", value: 3, msOnItem: 5_000 },
    ])).toBe(65);
  });
});

describe("score — dimensions", () => {
  it("scores an all-3s response set at 50 across all five dimensions", () => {
    const result = score(items, responses());
    expect(result.dimensions).toHaveLength(5);
    for (const d of result.dimensions) {
      expect(d.raw).toBe(18);
      expect(d.scaled).toBe(50);
      expect(d.band).toBe("Effective");
    }
  });

  it("reflects a reverse-scored item in the dimension raw total", () => {
    // WER-3 is reverse scored. Answering 5 scores 1, i.e. two below the all-3s baseline.
    const result = score(items, responses({ "WER-3": 5 }));
    const wer = result.dimensions.find((d) => d.code === "WER")!;
    expect(wer.raw).toBe(16);
  });

  it("excludes validity items from every competency dimension", () => {
    const result = score(items, responses({ "VAL-1": 5, "VAL-2": 5, "VAL-3": 5, "VAL-4": 5 }));
    expect(result.dimensions.map((d) => d.code)).toEqual(["WER", "COM", "PSL", "ADR", "INA"]);
    for (const d of result.dimensions) expect(d.raw).toBe(18);
  });
});

function flag(result: ReturnType<typeof score>, code: string) {
  return result.flags.find((f) => f.code === code)!;
}

describe("score — validity flags", () => {
  it("computes all four flags every time", () => {
    const codes = score(items, responses()).flags.map((f) => f.code);
    expect(codes).toEqual([
      "impressionManagement",
      "inconsistentResponding",
      "straightLining",
      "rushed",
    ]);
  });

  it("triggers impressionManagement when VAL-1 + VAL-2 >= 8", () => {
    expect(flag(score(items, responses({ "VAL-1": 4, "VAL-2": 4 })), "impressionManagement").triggered).toBe(true);
  });

  it("does not trigger impressionManagement at 7", () => {
    expect(flag(score(items, responses({ "VAL-1": 4, "VAL-2": 3 })), "impressionManagement").triggered).toBe(false);
  });

  it("triggers inconsistentResponding when the paired gaps total 4 or more", () => {
    // |WER-1 - VAL-3| = 2, |INA-1 - VAL-4| = 2  => 4
    const r = responses({ "WER-1": 5, "VAL-3": 3, "INA-1": 5, "VAL-4": 3 });
    expect(flag(score(items, r), "inconsistentResponding").triggered).toBe(true);
  });

  it("does not trigger inconsistentResponding when the gaps total 3", () => {
    const r = responses({ "WER-1": 5, "VAL-3": 3, "INA-1": 4, "VAL-4": 3 });
    expect(flag(score(items, r), "inconsistentResponding").triggered).toBe(false);
  });

  it("triggers straightLining on 12 identical consecutive raw values", () => {
    // All 34 answered 3 is one run of 34.
    expect(flag(score(items, responses()), "straightLining").triggered).toBe(true);
  });

  it("does not trigger straightLining when the longest run is 11", () => {
    // Break the run every 11 items by varying items at order 12, 24 (1-indexed).
    const breakers: Record<string, number> = {};
    for (const i of items) if (i.order % 11 === 0) breakers[i.id] = 5;
    expect(flag(score(items, responses(breakers)), "straightLining").triggered).toBe(false);
  });

  it("triggers rushed below 240 seconds", () => {
    // 34 items x 5s = 170s
    expect(flag(score(items, responses({}, 5_000)), "rushed").triggered).toBe(true);
  });

  it("does not trigger rushed at 240 seconds or above", () => {
    // 34 items x 20s = 680s
    expect(flag(score(items, responses({}, 20_000)), "rushed").triggered).toBe(false);
  });

  it("describes rushed timing as self-reported", () => {
    expect(flag(score(items, responses({}, 5_000)), "rushed").reason).toMatch(/self-reported/i);
  });

  it("never lets a flag change a dimension score", () => {
    const clean = score(items, responses({}, 20_000));
    const flagged = score(items, responses({ "VAL-1": 5, "VAL-2": 5 }, 1_000));
    expect(flagged.dimensions).toEqual(clean.dimensions);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `@/lib/scoring`.

- [ ] **Step 3: Write `src/lib/scoring.ts`**

```ts
export type Band = "Developing" | "Effective" | "Strong";

export type ItemDef = {
  id: string;
  dimension: string;
  order: number;
  reverseScored: boolean;
  isValidity: boolean;
};

export type RawResponse = { itemId: string; value: number; msOnItem: number };

export type DimensionScore = { code: string; raw: number; scaled: number; band: Band };
export type ValidityFlag = { code: string; triggered: boolean; reason: string };

export type Scored = {
  dimensions: DimensionScore[];
  flags: ValidityFlag[];
  totalSeconds: number;
};

export const COMPETENCY_CODES = ["WER", "COM", "PSL", "ADR", "INA"] as const;
export const MS_PER_ITEM_CAP = 60_000;
export const STRAIGHT_LINE_RUN = 12;
export const RUSHED_SECONDS = 240;

export function itemScore(value: number, reverseScored: boolean): number {
  return reverseScored ? 6 - value : value;
}

export function scaleDimension(raw: number): number {
  return Math.round(((raw - 6) / 24) * 100);
}

export function bandFor(scaled: number): Band {
  if (scaled < 45) return "Developing";
  if (scaled < 70) return "Effective";
  return "Strong";
}

export function totalSecondsFrom(responses: RawResponse[]): number {
  const ms = responses.reduce((sum, r) => sum + Math.min(r.msOnItem, MS_PER_ITEM_CAP), 0);
  return Math.round(ms / 1000);
}

function longestRun(values: number[]): number {
  let best = 0;
  let current = 0;
  let previous: number | null = null;
  for (const v of values) {
    current = v === previous ? current + 1 : 1;
    previous = v;
    if (current > best) best = current;
  }
  return best;
}

function buildFlags(
  items: ItemDef[],
  valueOf: (id: string) => number,
  totalSeconds: number,
): ValidityFlag[] {
  const impression = valueOf("VAL-1") + valueOf("VAL-2") >= 8;

  const inconsistency =
    Math.abs(valueOf("WER-1") - valueOf("VAL-3")) +
    Math.abs(valueOf("INA-1") - valueOf("VAL-4"));
  const inconsistent = inconsistency >= 4;

  const inOrder = [...items].sort((a, b) => a.order - b.order).map((i) => valueOf(i.id));
  const run = longestRun(inOrder);
  const straightLining = run >= STRAIGHT_LINE_RUN;

  const rushed = totalSeconds < RUSHED_SECONDS;

  return [
    {
      code: "impressionManagement",
      triggered: impression,
      reason: impression
        ? "Both social-desirability items were answered at the top of the scale."
        : "Social-desirability items were answered in the expected range.",
    },
    {
      code: "inconsistentResponding",
      triggered: inconsistent,
      reason: inconsistent
        ? "Paired items covering the same ground were answered differently."
        : "Paired items were answered consistently.",
    },
    {
      code: "straightLining",
      triggered: straightLining,
      reason: straightLining
        ? `The same answer was given on ${run} items in a row.`
        : "Answers varied across the questionnaire.",
    },
    {
      code: "rushed",
      triggered: rushed,
      reason: rushed
        ? "Self-reported time on task was under 4 minutes."
        : "Self-reported time on task was 4 minutes or more.",
    },
  ];
}

export function score(items: ItemDef[], responses: RawResponse[]): Scored {
  const byId = new Map(responses.map((r) => [r.itemId, r.value]));
  const valueOf = (id: string) => byId.get(id) ?? 0;

  const dimensions = COMPETENCY_CODES.map((code) => {
    const raw = items
      .filter((i) => i.dimension === code)
      .reduce((sum, i) => sum + itemScore(valueOf(i.id), i.reverseScored), 0);
    const scaled = scaleDimension(raw);
    return { code: code as string, raw, scaled, band: bandFor(scaled) };
  });

  const totalSeconds = totalSecondsFrom(responses);

  return { dimensions, flags: buildFlags(items, valueOf, totalSeconds), totalSeconds };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS, all scoring tests green.

- [ ] **Step 5: Verify scoring is pure**

Run: `grep -rn "prisma\|@/lib/db" src/lib/scoring.ts`
Expected: no output. This is the spec §11 Phase 2 "Done when" gate.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring.ts tests/unit/scoring.test.ts
git commit -m "feat: add pure scoring engine with validity flags"
```

---

## Task 5: Status transitions

**Files:**
- Create: `src/lib/status.ts`
- Test: `tests/unit/status.test.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces:
  - `type Status = "DRAFT" | "SENT" | "STARTED" | "SUBMITTED" | "SCORED" | "EXPIRED" | "REVOKED"`
  - `canTransition(from: Status, to: Status): boolean`
  - `assertTransition(from: Status, to: Status): void` — throws `IllegalStatusTransition`
  - `class IllegalStatusTransition extends Error`
  - `applyStatus(candidateId: string, to: Status, extra?: Record<string, unknown>): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Only the pure functions are unit tested; `applyStatus` needs a database and is covered by the
Playwright specs.

```ts
import { describe, it, expect } from "vitest";
import { canTransition, assertTransition, IllegalStatusTransition, type Status } from "@/lib/status";

const legal: [Status, Status][] = [
  ["DRAFT", "SENT"],
  ["SENT", "STARTED"], ["SENT", "EXPIRED"], ["SENT", "REVOKED"],
  ["STARTED", "SUBMITTED"], ["STARTED", "EXPIRED"], ["STARTED", "REVOKED"],
  ["SUBMITTED", "SCORED"],
  ["EXPIRED", "SENT"], ["REVOKED", "SENT"],
];

const illegal: [Status, Status][] = [
  ["DRAFT", "STARTED"],
  ["SENT", "SUBMITTED"],
  ["SENT", "SCORED"],
  ["STARTED", "SENT"],
  ["SUBMITTED", "STARTED"],
  ["SCORED", "SENT"],
  ["SCORED", "SCORED"],
  ["REVOKED", "STARTED"],
];

describe("canTransition", () => {
  it.each(legal)("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(illegal)("rejects %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("treats SCORED as terminal", () => {
    const all: Status[] = ["DRAFT", "SENT", "STARTED", "SUBMITTED", "SCORED", "EXPIRED", "REVOKED"];
    for (const to of all) expect(canTransition("SCORED", to)).toBe(false);
  });
});

describe("assertTransition", () => {
  it("returns silently for a legal transition", () => {
    expect(() => assertTransition("DRAFT", "SENT")).not.toThrow();
  });

  it("throws IllegalStatusTransition for an illegal one", () => {
    expect(() => assertTransition("SCORED", "SENT")).toThrow(IllegalStatusTransition);
  });

  it("names both states in the error message", () => {
    expect(() => assertTransition("SCORED", "SENT")).toThrow(/SCORED.*SENT/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/unit/status.test.ts`
Expected: FAIL — cannot resolve `@/lib/status`.

- [ ] **Step 3: Write `src/lib/status.ts`**

```ts
import { db } from "@/lib/db";

export const STATUSES = [
  "DRAFT", "SENT", "STARTED", "SUBMITTED", "SCORED", "EXPIRED", "REVOKED",
] as const;

export type Status = (typeof STATUSES)[number];

const LEGAL: Record<Status, Status[]> = {
  DRAFT: ["SENT"],
  SENT: ["STARTED", "EXPIRED", "REVOKED"],
  STARTED: ["SUBMITTED", "EXPIRED", "REVOKED"],
  SUBMITTED: ["SCORED"],
  SCORED: [],
  EXPIRED: ["SENT"],
  REVOKED: ["SENT"],
};

export class IllegalStatusTransition extends Error {
  constructor(from: Status, to: Status) {
    super(`Illegal status transition: ${from} -> ${to}`);
    this.name = "IllegalStatusTransition";
  }
}

export function canTransition(from: Status, to: Status): boolean {
  return LEGAL[from]?.includes(to) ?? false;
}

export function assertTransition(from: Status, to: Status): void {
  if (!canTransition(from, to)) throw new IllegalStatusTransition(from, to);
}

/**
 * The only writer of Candidate.status anywhere in the codebase.
 * `extra` carries the timestamp columns that accompany a transition,
 * e.g. { startedAt: new Date() } alongside STARTED.
 */
export async function applyStatus(
  candidateId: string,
  to: Status,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { status: true },
  });
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);

  assertTransition(candidate.status as Status, to);

  await db.candidate.update({
    where: { id: candidateId },
    data: { status: to, ...extra },
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test tests/unit/status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/status.ts tests/unit/status.test.ts
git commit -m "feat: add status transition table as the sole status writer"
```

---

## Task 6: Tokens and environment validation

**Files:**
- Create: `src/lib/tokens.ts`, `src/lib/env.ts`
- Test: `tests/unit/tokens.test.ts`, `tests/unit/env.test.ts`

**Interfaces:**
- Produces:
  - `generateToken(): string` — 32 random bytes, base64url
  - `hashToken(token: string): string` — sha256 hex
  - `inviteUrl(appUrl: string, token: string): string`
  - `expiryFromNow(days: number, now?: Date): Date`
  - `env` — the validated environment object
  - `envSchema` — the Zod schema, exported for testing

- [ ] **Step 1: Write the failing tests**

`tests/unit/tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateToken, hashToken, inviteUrl, expiryFromNow } from "@/lib/tokens";

describe("generateToken", () => {
  it("produces a url-safe string with no padding", () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces 32 bytes of entropy", () => {
    expect(Buffer.from(generateToken(), "base64url")).toHaveLength(32);
  });

  it("never repeats across many draws", () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateToken()));
    expect(seen.size).toBe(1000);
  });
});

describe("hashToken", () => {
  it("is stable for the same input", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("differs for different inputs", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });

  it("does not contain the raw token", () => {
    const token = generateToken();
    expect(hashToken(token)).not.toContain(token);
  });

  it("produces a 64-character hex digest", () => {
    expect(hashToken("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("inviteUrl", () => {
  it("builds the candidate entry url", () => {
    expect(inviteUrl("https://x.test", "TOK")).toBe("https://x.test/a/TOK");
  });

  it("tolerates a trailing slash on the base url", () => {
    expect(inviteUrl("https://x.test/", "TOK")).toBe("https://x.test/a/TOK");
  });
});

describe("expiryFromNow", () => {
  it("adds whole days", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(expiryFromNow(14, now).toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });
});
```

`tests/unit/env.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { envSchema } from "@/lib/env";

const valid = {
  DATABASE_URL: "postgresql://u:p@h/db",
  DIRECT_URL: "postgresql://u:p@h/db",
  APP_URL: "http://localhost:3000",
  APP_SECRET: "0123456789abcdef0123456789abcdef",
  ADMIN_EMAIL: "hr@example.com",
  ADMIN_PASSWORD: "a-generated-password-of-24-plus",
  MAIL_FROM: "Afenda <no-reply@example.com>",
  INVITE_TTL_DAYS: "14",
  RETENTION_DAYS: "180",
};

describe("envSchema", () => {
  it("accepts a complete valid environment", () => {
    expect(envSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing APP_SECRET", () => {
    const { APP_SECRET, ...rest } = valid;
    expect(envSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a missing ADMIN_PASSWORD", () => {
    const { ADMIN_PASSWORD, ...rest } = valid;
    expect(envSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an ADMIN_PASSWORD shorter than 24 characters", () => {
    const result = envSchema.safeParse({ ...valid, ADMIN_PASSWORD: "short-password-23-chars" });
    expect(result.success).toBe(false);
  });

  it("rejects an APP_SECRET shorter than 32 characters", () => {
    expect(envSchema.safeParse({ ...valid, APP_SECRET: "too-short" }).success).toBe(false);
  });

  it("coerces day counts to numbers", () => {
    const parsed = envSchema.parse(valid);
    expect(parsed.INVITE_TTL_DAYS).toBe(14);
    expect(parsed.RETENTION_DAYS).toBe(180);
  });

  it("defaults RESEND_API_KEY to an empty string so dev uses the console transport", () => {
    expect(envSchema.parse(valid).RESEND_API_KEY).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/unit/tokens.test.ts tests/unit/env.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `src/lib/tokens.ts`**

```ts
import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, base64url. Appears exactly once: in the emailed URL. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The only form of a token that may be persisted. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/a/${token}`;
}

export function expiryFromNow(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
```

- [ ] **Step 4: Write `src/lib/env.ts`**

```ts
import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
  APP_URL: z.string().url(),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z
    .string()
    .min(24, "ADMIN_PASSWORD must be at least 24 characters — generate it, do not choose it"),
  RESEND_API_KEY: z.string().default(""),
  MAIL_FROM: z.string().min(1),
  INVITE_TTL_DAYS: z.coerce.number().int().positive().default(14),
  RETENTION_DAYS: z.coerce.number().int().positive().default(180),
});

export type Env = z.infer<typeof envSchema>;

function load(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${detail}`);
  }
  return parsed.data;
}

export const env = load();
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS — scoring, status, tokens and env all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tokens.ts src/lib/env.ts tests/unit
git commit -m "feat: add token helpers and fail-fast env validation"
```

---

## Task 7: Audit log with a PII guard

**Files:**
- Create: `src/lib/audit.ts`
- Test: `tests/unit/audit.test.ts`

**Interfaces:**
- Produces:
  - `type AuditAction` — the closed set of audited actions
  - `assertNoPii(meta: unknown): void` — throws if meta looks like it contains a name or email
  - `audit(actor: string, action: AuditAction, subjectId?: string, meta?: Record<string, unknown>): Promise<void>`

- [ ] **Step 1: Write the failing tests**

The guard is the testable part; the write itself is covered end to end in Task 20.

```ts
import { describe, it, expect } from "vitest";
import { assertNoPii } from "@/lib/audit";

describe("assertNoPii", () => {
  it("accepts non-identifying meta", () => {
    expect(() => assertNoPii({ count: 3, status: "SENT" })).not.toThrow();
  });

  it("accepts undefined", () => {
    expect(() => assertNoPii(undefined)).not.toThrow();
  });

  it("rejects a value that looks like an email address", () => {
    expect(() => assertNoPii({ who: "someone@example.com" })).toThrow(/email/i);
  });

  it("rejects an email nested inside an array", () => {
    expect(() => assertNoPii({ batch: ["a@b.co"] })).toThrow(/email/i);
  });

  it("rejects a key named email or fullName regardless of value", () => {
    expect(() => assertNoPii({ email: "redacted" })).toThrow();
    expect(() => assertNoPii({ fullName: "redacted" })).toThrow();
  });

  it("rejects anything that looks like a base64url token of 32 bytes", () => {
    expect(() => assertNoPii({ t: "A".repeat(43) })).toThrow(/token/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/unit/audit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/audit.ts`**

```ts
import { db } from "@/lib/db";

export type AuditAction =
  | "admin.login"
  | "invite.created"
  | "invite.resent"
  | "invite.revoked"
  | "candidate.consented"
  | "assessment.submitted"
  | "result.viewed"
  | "export.downloaded"
  | "candidate.deleted"
  | "data.purged";

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,}$/;
const BANNED_KEYS = new Set(["email", "fullname", "name", "token", "password"]);

/**
 * Audit rows carry identifiers, never identities or secrets.
 * Enforces spec §13.2 (no raw tokens) and the retention invariant (no names or emails),
 * so that purging candidate data actually removes every identifying trace.
 */
export function assertNoPii(meta: unknown): void {
  const walk = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      if (EMAIL_PATTERN.test(value)) {
        throw new Error(`Audit meta at "${path}" looks like an email address`);
      }
      if (TOKEN_PATTERN.test(value)) {
        throw new Error(`Audit meta at "${path}" looks like a raw token`);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, v] of Object.entries(value)) {
        if (BANNED_KEYS.has(key.toLowerCase())) {
          throw new Error(`Audit meta must not contain the key "${key}"`);
        }
        walk(v, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(meta, "");
}

export async function audit(
  actor: string,
  action: AuditAction,
  subjectId?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  assertNoPii(meta);
  await db.auditEvent.create({
    data: { actor, action, subjectId: subjectId ?? null, meta: meta ?? undefined },
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test tests/unit/audit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit.ts tests/unit/audit.test.ts
git commit -m "feat: add audit log with a PII and token guard"
```

---

## Task 8: Admin authentication and rate limiting

**Files:**
- Create: `src/lib/auth-admin.ts`, `src/lib/rate-limit.ts`, `src/app/api/admin/login/route.ts`, `src/app/admin/login/page.tsx`, `proxy.ts`
- Test: `tests/unit/auth-admin.test.ts`

**Interfaces:**
- Consumes: `env`, `db`, `audit`
- Produces:
  - `ADMIN_COOKIE = "afenda_admin"`
  - `passwordMatches(submitted: string, expected: string): boolean`
  - `createAdminToken(): Promise<string>`
  - `verifyAdminToken(token: string | undefined): Promise<boolean>`
  - `requireAdmin(): Promise<void>` — throws if the cookie is absent or invalid
  - `isRateLimited(ip: string): Promise<boolean>`, `recordFailure(ip: string): Promise<void>`, `clearFailures(ip: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { passwordMatches, createAdminToken, verifyAdminToken } from "@/lib/auth-admin";

describe("passwordMatches", () => {
  it("accepts the correct password", () => {
    expect(passwordMatches("correct-horse-battery-staple", "correct-horse-battery-staple")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(passwordMatches("wrong", "correct-horse-battery-staple")).toBe(false);
  });

  it("rejects without leaking length through an early return", () => {
    // Both comparisons hash to a fixed width first, so differing lengths are still compared.
    expect(passwordMatches("a", "correct-horse-battery-staple")).toBe(false);
    expect(passwordMatches("correct-horse-battery-stapleX", "correct-horse-battery-staple")).toBe(false);
  });
});

describe("admin token", () => {
  it("round-trips a freshly minted token", async () => {
    expect(await verifyAdminToken(await createAdminToken())).toBe(true);
  });

  it("rejects undefined", async () => {
    expect(await verifyAdminToken(undefined)).toBe(false);
  });

  it("rejects a garbage token", async () => {
    expect(await verifyAdminToken("not.a.jwt")).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const { SignJWT } = await import("jose");
    const foreign = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode("an-entirely-different-secret-value"));
    expect(await verifyAdminToken(foreign)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/unit/auth-admin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/auth-admin.ts`**

Admin only. This file must never mention `afenda_candidate`.

```ts
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

export const ADMIN_COOKIE = "afenda_admin";

const secret = () => new TextEncoder().encode(env.APP_SECRET);
const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compares fixed-width digests so the comparison time does not depend on the input. */
export function passwordMatches(submitted: string, expected: string): boolean {
  return timingSafeEqual(digest(submitted), digest(expected));
}

export async function createAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
}

export async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** For server components and admin route handlers. */
export async function requireAdmin(): Promise<void> {
  const store = await cookies();
  const ok = await verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
  if (!ok) throw new Error("Not authenticated as admin");
}
```

- [ ] **Step 4: Write `src/lib/rate-limit.ts`**

```ts
import { db } from "@/lib/db";

export const MAX_FAILURES = 5;
export const WINDOW_MINUTES = 15;
const PRUNE_AFTER_MINUTES = 60;

/** True when this IP has already failed MAX_FAILURES times inside the window. */
export async function isRateLimited(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  const failures = await db.loginAttempt.count({ where: { ip, createdAt: { gte: since } } });
  return failures >= MAX_FAILURES;
}

/** Only failures are recorded — otherwise a working admin locks themselves out. */
export async function recordFailure(ip: string): Promise<void> {
  await db.loginAttempt.create({ data: { ip } });
  await db.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - PRUNE_AFTER_MINUTES * 60_000) } },
  });
}

/** A success clears the run, so the counter measures consecutive failures. */
export async function clearFailures(ip: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { ip } });
}
```

- [ ] **Step 5: Write `src/app/api/admin/login/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { ADMIN_COOKIE, createAdminToken, passwordMatches } from "@/lib/auth-admin";
import { isRateLimited, recordFailure, clearFailures } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const bodySchema = z.object({ password: z.string().min(1) });

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const ip = clientIp(request);
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  if (!passwordMatches(parsed.data.password, env.ADMIN_PASSWORD)) {
    await recordFailure(ip);
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  await clearFailures(ip);
  await audit("admin", "admin.login");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, await createAdminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}
```

- [ ] **Step 6: Write `proxy.ts` at the repository root**

Next 16 renames the `middleware` file convention to `proxy` and the exported function to
`proxy()`. It runs on the Node.js runtime, which is fixed and cannot be configured.

It could therefore query Prisma — and deliberately does not. It checks the JWT signature and
expiry, nothing more. Per D7, a gate that looked authoritative would invite handlers to skip
their own status checks, and the handler must check regardless.

```ts
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const ADMIN_COOKIE = "afenda_admin";
const CANDIDATE_COOKIE = "afenda_candidate";

const secret = () => new TextEncoder().encode(process.env.APP_SECRET!);

async function claims(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/candidate")) {
    const payload = await claims(request.cookies.get(CANDIDATE_COOKIE)?.value);
    if (!payload?.candidateId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const payload = await claims(request.cookies.get(ADMIN_COOKIE)?.value);
  if (payload?.role === "admin") return NextResponse.next();

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/candidate/:path*",
  ],
};
```

Then exclude the login routes, which must stay reachable. Add at the top of `proxy`:

```ts
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }
```

This is a coarse gate by choice. It proves the cookie's signature has not expired; it does not
check whether a candidate has been revoked or has already submitted. Every handler re-checks.

- [ ] **Step 7: Write `src/app/admin/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (response.ok) {
      router.push("/admin");
      router.refresh();
      return;
    }
    const body = await response.json().catch(() => ({}));
    setError(body.error ?? "Sign in failed");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">Afenda Talents</h1>
      <p className="mt-1 text-sm text-muted-foreground">Hiring manager sign in</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 8: Add a placeholder `src/app/admin/page.tsx` so the redirect has a target**

```tsx
export default function AdminDashboardPage() {
  return <main className="p-6"><h1 className="text-2xl font-semibold">Candidates</h1></main>;
}
```

- [ ] **Step 9: Run the unit tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 10: Write the Playwright spec for the admin gate**

`tests/e2e/01-admin-auth.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const PASSWORD = process.env.ADMIN_PASSWORD!;

test("redirects to login when signed out", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("loads the dashboard after signing in", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Candidates" })).toBeVisible();
});

test("returns 429 after six rapid wrong passwords", async ({ request }) => {
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const response = await request.post("/api/admin/login", { data: { password: `wrong-${i}` } });
    statuses.push(response.status());
  }
  expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
  expect(statuses[5]).toBe(429);
});

test("a successful login clears the failure run", async ({ request }) => {
  for (let i = 0; i < 3; i++) {
    await request.post("/api/admin/login", { data: { password: `wrong-${i}` } });
  }
  expect((await request.post("/api/admin/login", { data: { password: PASSWORD } })).status()).toBe(200);
  expect((await request.post("/api/admin/login", { data: { password: "wrong" } })).status()).toBe(401);
});
```

- [ ] **Step 11: Prepare the test database and run the e2e spec**

```bash
pnpm dotenv -e .env.test -- prisma migrate deploy
pnpm dotenv -e .env.test -- prisma db seed
pnpm test:e2e tests/e2e/01-admin-auth.spec.ts
```

Expected: 4 passed. This is the spec §11 Phase 3 "Done when" gate. Paste the output.

- [ ] **Step 12: Commit**

```bash
git add src/lib/auth-admin.ts src/lib/rate-limit.ts src/app/api/admin/login src/app/admin proxy.ts tests
git commit -m "feat: add admin auth, database-backed rate limiting, and the proxy gate"
```

---

## Task 9: Email module with a console transport

**Files:**
- Create: `src/lib/email.ts`

**Interfaces:**
- Consumes: `env`
- Produces:
  - `sendInvitation(to: string, fullName: string, url: string, expiresAt: Date): Promise<void>`
  - `sendReminder(to: string, fullName: string, url: string, expiresAt: Date): Promise<void>`
  - `sendReceipt(to: string, fullName: string): Promise<void>`

- [ ] **Step 1: Write `src/lib/email.ts`**

The console transport is not a nicety — it is how the whole flow gets tested locally, so it
must print the full message including the link.

```ts
import { Resend } from "resend";
import { env } from "@/lib/env";

type Message = { to: string; subject: string; html: string };

const shell = (body: string) =>
  `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111">${body}</div>`;

async function send(message: Message): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(
      [
        "",
        "──────── EMAIL (console transport) ────────",
        `To:      ${message.to}`,
        `From:    ${env.MAIL_FROM}`,
        `Subject: ${message.subject}`,
        "",
        message.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        "───────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return;
  }
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({ from: env.MAIL_FROM, ...message });
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export async function sendInvitation(to: string, fullName: string, url: string, expiresAt: Date) {
  await send({
    to,
    subject: "Your Afenda Talents self-assessment",
    html: shell(`
      <p>Hello ${fullName},</p>
      <p>As part of our hiring process, we would like you to complete a short self-assessment.
         It covers how you work — reliability, communication, problem solving, adaptability and
         accountability — and takes about 12 minutes.</p>
      <p><strong>There are no right or wrong answers.</strong> Answer as you actually work, not
         as you think we want to read.</p>
      <p><a href="${url}">Start the assessment</a></p>
      <p>This link is personal to you and expires on ${formatDate(expiresAt)}.</p>
    `),
  });
}

export async function sendReminder(to: string, fullName: string, url: string, expiresAt: Date) {
  await send({
    to,
    subject: "Reminder: your Afenda Talents self-assessment",
    html: shell(`
      <p>Hello ${fullName},</p>
      <p>A reminder that your self-assessment is still open. It takes about 12 minutes and there
         are no right or wrong answers.</p>
      <p><a href="${url}">Continue the assessment</a></p>
      <p>This link expires on ${formatDate(expiresAt)}.</p>
    `),
  });
}

export async function sendReceipt(to: string, fullName: string) {
  await send({
    to,
    subject: "We have received your Afenda Talents self-assessment",
    html: shell(`
      <p>Hello ${fullName},</p>
      <p>Thank you — your self-assessment has been received. No further action is needed from you.</p>
      <p>Your responses form one input into our hiring decision and will be reviewed alongside the
         rest of your application.</p>
    `),
  });
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: add email templates with a console transport for development"
```

---

## Task 10: Invitations — create, resend, revoke

**Files:**
- Create: `src/app/api/admin/invite/route.ts`, `src/app/api/admin/invite/[id]/resend/route.ts`, `src/app/api/admin/invite/[id]/revoke/route.ts`, `src/app/admin/invite/page.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `generateToken`, `hashToken`, `inviteUrl`, `expiryFromNow`, `applyStatus`, `sendInvitation`, `audit`, `env`
- Produces: candidates in status `SENT` with a `tokenHash` and `expiresAt`.

- [ ] **Step 1: Write `src/app/api/admin/invite/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { applyStatus } from "@/lib/status";
import { expiryFromNow, generateToken, hashToken, inviteUrl } from "@/lib/tokens";
import { sendInvitation } from "@/lib/email";

export const runtime = "nodejs";

const bodySchema = z.object({
  candidates: z
    .array(z.object({ fullName: z.string().min(1).max(120), email: z.string().email() }))
    .min(1)
    .max(200),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a name and a valid email for each candidate" }, { status: 400 });
  }

  const invited: string[] = [];
  const skipped: string[] = [];

  for (const entry of parsed.data.candidates) {
    const email = entry.email.trim().toLowerCase();
    if (await db.candidate.findUnique({ where: { email } })) {
      skipped.push(email);
      continue;
    }

    const token = generateToken();
    const expiresAt = expiryFromNow(env.INVITE_TTL_DAYS);

    const candidate = await db.candidate.create({
      data: { email, fullName: entry.fullName.trim(), tokenHash: hashToken(token), expiresAt },
    });

    await applyStatus(candidate.id, "SENT", { sentAt: new Date() });
    await sendInvitation(email, candidate.fullName, inviteUrl(env.APP_URL, token), expiresAt);
    await audit("admin", "invite.created", candidate.id);
    invited.push(candidate.id);
  }

  return NextResponse.json({ invited: invited.length, skipped: skipped.length });
}
```

The raw `token` is used to build the URL and then goes out of scope. It is never written to
the database, the audit row, or the response body.

- [ ] **Step 2: Write `src/app/api/admin/invite/[id]/resend/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { applyStatus, canTransition, type Status } from "@/lib/status";
import { expiryFromNow, generateToken, hashToken, inviteUrl } from "@/lib/tokens";
import { sendInvitation } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const from = candidate.status as Status;
  const target: Status = from === "SENT" ? "SENT" : "SENT";
  if (from !== "SENT" && !canTransition(from, target)) {
    return NextResponse.json({ error: `Cannot resend from status ${from}` }, { status: 409 });
  }

  const token = generateToken();
  const expiresAt = expiryFromNow(env.INVITE_TTL_DAYS);

  // Issuing the new hash invalidates the previous link immediately.
  await db.candidate.update({
    where: { id },
    data: { tokenHash: hashToken(token), expiresAt, sentAt: new Date(), openedAt: null },
  });
  if (from !== "SENT") await applyStatus(id, "SENT");

  await sendInvitation(candidate.email, candidate.fullName, inviteUrl(env.APP_URL, token), expiresAt);
  await audit("admin", "invite.resent", id);

  return NextResponse.json({ ok: true });
}
```

Note the `from === "SENT"` case: re-sending to a candidate who has not started is a fresh token
with no status change, which the transition table does not model as `SENT → SENT`. Calling
`applyStatus` there would throw, so it is skipped.

- [ ] **Step 3: Write `src/app/api/admin/invite/[id]/revoke/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { applyStatus } from "@/lib/status";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await applyStatus(id, "REVOKED");
  await db.candidate.update({ where: { id }, data: { tokenHash: null } });
  await audit("admin", "invite.revoked", id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write `src/app/admin/invite/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Entry = { fullName: string; email: string };

function parsePasted(text: string): Entry[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [fullName, email] = line.split(",").map((part) => part?.trim() ?? "");
      return { fullName, email };
    })
    .filter((entry) => entry.fullName && entry.email);
}

export default function InvitePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pasted, setPasted] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const candidates = [...parsePasted(pasted)];
    if (fullName && email) candidates.unshift({ fullName, email });
    if (candidates.length === 0) {
      setMessage("Add at least one candidate.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error ?? "Could not send invitations");
      return;
    }
    setMessage(`Invited ${body.invited}. Skipped ${body.skipped} already-invited address(es).`);
    setFullName(""); setEmail(""); setPasted("");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Invite candidates</h1>
      <form onSubmit={submit} className="mt-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pasted">Or paste many, one per line as “Name, email”</Label>
          <Textarea
            id="pasted"
            rows={8}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"Amira Yusof, amira@example.com\nDaniel Tan, daniel@example.com"}
          />
        </div>
        {message && <p role="status" className="text-sm">{message}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send invitations"}</Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Replace `src/app/admin/page.tsx` with the candidate table**

```tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-admin";
import { Button } from "@/components/ui/button";
import { CandidateRowActions } from "@/components/candidate-row-actions";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["SENT", "STARTED", "SUBMITTED", "SCORED", "EXPIRED", "REVOKED"] as const;

export default async function AdminDashboardPage() {
  await requireAdmin();

  const candidates = await db.candidate.findMany({ orderBy: { createdAt: "asc" } });
  const counts = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, candidates.filter((c) => c.status === s).length]),
  );

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Candidates</h1>
        <Button asChild><Link href="/admin/invite">Invite candidates</Link></Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="rounded-md border px-3 py-2 text-sm">
            <span className="font-medium">{counts[status]}</span>{" "}
            <span className="text-muted-foreground">{status}</span>
          </div>
        ))}
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-muted-foreground">
          <tr>
            <th className="py-2">Name</th><th>Email</th><th>Status</th>
            <th>Invited</th><th>Submitted</th><th />
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id} className="border-b">
              <td className="py-2">
                {c.status === "SCORED"
                  ? <Link className="underline" href={`/admin/candidate/${c.id}`}>{c.fullName}</Link>
                  : c.fullName}
              </td>
              <td>{c.email}</td>
              <td>{c.status}</td>
              <td>{c.sentAt?.toLocaleDateString("en-GB") ?? "—"}</td>
              <td>{c.submittedAt?.toLocaleDateString("en-GB") ?? "—"}</td>
              <td className="text-right"><CandidateRowActions id={c.id} status={c.status} /></td>
            </tr>
          ))}
          {candidates.length === 0 && (
            <tr><td colSpan={6} className="py-6 text-muted-foreground">No candidates invited yet.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 6: Write `src/components/candidate-row-actions.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CandidateRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(action: "resend" | "revoke") {
    setBusy(true);
    await fetch(`/api/admin/invite/${id}/${action}`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  const terminal = status === "SUBMITTED" || status === "SCORED";

  return (
    <div className="flex justify-end gap-2">
      {!terminal && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => call("resend")}>
          Resend
        </Button>
      )}
      {!terminal && status !== "REVOKED" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => call("revoke")}>
          Revoke
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write `src/app/api/admin/invite/[id]/remind/route.ts`**

Spec §8 requires a reminder the HR Manager sends by hand. It reuses the existing invitation
token rather than issuing a new one — a reminder that silently invalidated the candidate's
original link would be a trap.

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * A reminder cannot include a link: the raw token was destroyed after the invitation was
 * sent, and only its hash is stored. Re-sending a link therefore means issuing a new token,
 * which is what /resend does. This endpoint exists so the distinction is explicit.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(
    { error: "Use Resend — a reminder with a working link requires a fresh token." },
    { status: 409 },
  );
}
```

Then delete this route and **remove `sendReminder` from `src/lib/email.ts`**. The reasoning
belongs in `DECISIONS.md` instead:

> **D12 — No separate reminder email.** Spec §8 lists a manually-sent reminder as a third
> template. Because only `sha256(token)` is stored, the server cannot reconstruct a
> candidate's original link, so any reminder containing a usable link *is* a resend with a new
> token. Rather than ship two buttons that do the same thing while one pretends not to,
> "Resend" is the single action, and its email says the link may have changed. The reminder
> template is not built.

Add that entry to `DECISIONS.md` now, and change the `sendInvitation` body in
`src/lib/email.ts` to cover both cases by appending:

```
      <p>If you have received this message before, use the link above — it is the current one.</p>
```

- [ ] **Step 8: Manually verify the console transport prints two distinct links**

```bash
pnpm dev
```

Sign in, invite two candidates, and read stdout.
Expected: two `EMAIL (console transport)` blocks with two different `/a/…` URLs, and both rows
showing `SENT`. This is part of the spec §11 Phase 4 "Done when" gate.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/admin/invite src/app/admin src/components/candidate-row-actions.tsx src/lib/email.ts DECISIONS.md
git commit -m "feat: add invite, resend and revoke with the candidate dashboard"
```

---

## Task 11: Candidate authentication and the consent page

**Files:**
- Create: `src/lib/auth-candidate.ts`, `src/app/a/[token]/page.tsx`, `src/app/api/candidate/consent/route.ts`, `src/app/a/[token]/done/page.tsx`

**Interfaces:**
- Consumes: `hashToken`, `applyStatus`, `audit`, `env`
- Produces:
  - `CANDIDATE_COOKIE = "afenda_candidate"`
  - `resolveToken(token: string): Promise<Candidate | null>` — hash, look up, reject expired/revoked/finished
  - `createCandidateToken(candidateId: string): Promise<string>`
  - `currentCandidateId(): Promise<string | null>`
  - `requireCandidate(): Promise<Candidate>` — re-reads the row and re-checks status; throws otherwise

- [ ] **Step 1: Write `src/lib/auth-candidate.ts`**

Candidate only. This file must never mention `afenda_admin`.

```ts
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Candidate } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashToken } from "@/lib/tokens";

export const CANDIDATE_COOKIE = "afenda_candidate";

const secret = () => new TextEncoder().encode(env.APP_SECRET);

/** Statuses from which a candidate may still be working. */
const OPEN_STATUSES = new Set(["SENT", "STARTED"]);

/**
 * Resolves a raw path token to a candidate, or null.
 * Null covers: unknown token, expired invitation, revoked, and already finished.
 * Callers must render the same 404 for every null so the cases are indistinguishable.
 */
export async function resolveToken(token: string): Promise<Candidate | null> {
  const candidate = await db.candidate.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!candidate) return null;
  if (candidate.expiresAt && candidate.expiresAt.getTime() < Date.now()) return null;
  if (!OPEN_STATUSES.has(candidate.status)) return null;
  return candidate;
}

export async function createCandidateToken(candidateId: string): Promise<string> {
  return new SignJWT({ candidateId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(secret());
}

export async function currentCandidateId(): Promise<string | null> {
  const value = (await cookies()).get(CANDIDATE_COOKIE)?.value;
  if (!value) return null;
  try {
    const { payload } = await jwtVerify(value, secret());
    return typeof payload.candidateId === "string" ? payload.candidateId : null;
  } catch {
    return null;
  }
}

/**
 * For /api/candidate/* handlers. Middleware has already checked the signature;
 * this re-reads the row because the proxy gate deliberately does not check status.
 */
export async function requireCandidate(): Promise<Candidate> {
  const id = await currentCandidateId();
  if (!id) throw new Error("No candidate session");
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) throw new Error("Candidate not found");
  if (!OPEN_STATUSES.has(candidate.status)) throw new Error("Assessment is closed");
  if (candidate.expiresAt && candidate.expiresAt.getTime() < Date.now()) throw new Error("Invitation expired");
  return candidate;
}
```

- [ ] **Step 2: Write `src/app/a/[token]/page.tsx` — the consent page**

The consent text names what is collected, who sees it, and how long it is kept, with the
retention period interpolated from `env` so the promise and the configuration cannot drift.

```tsx
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { CANDIDATE_COOKIE, createCandidateToken, resolveToken } from "@/lib/auth-candidate";
import { ConsentForm } from "@/components/consent-form";

export const dynamic = "force-dynamic";

export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const candidate = await resolveToken(token);
  if (!candidate) redirect(`/a/${token}/done`);

  if (candidate.status === "STARTED") redirect(`/a/${token}/assessment`);

  if (!candidate.openedAt) {
    await db.candidate.update({ where: { id: candidate.id }, data: { openedAt: new Date() } });
  }

  const store = await cookies();
  store.set(CANDIDATE_COOKIE, await createCandidateToken(candidate.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 4 * 60 * 60,
  });

  return (
    <main className="mx-auto max-w-xl p-5 pb-24">
      <h1 className="text-xl font-semibold">Before you begin</h1>
      <p className="mt-3 text-sm">Hello {candidate.fullName},</p>
      <div className="mt-4 space-y-3 text-sm leading-relaxed">
        <p>
          This is a short self-assessment about how you work. It has 34 statements and takes about
          12 minutes. <strong>There are no right or wrong answers</strong>, and it is not a test you
          can pass or fail.
        </p>
        <h2 className="pt-2 font-medium">What we collect</h2>
        <p>
          Your name and email address, your answer to each of the 34 statements, and how long you
          spend on each one.
        </p>
        <h2 className="pt-2 font-medium">Who sees it</h2>
        <p>
          Only the hiring manager for this role. Your answers form one input into a hiring decision
          and are considered alongside the rest of your application. They are not shared with anyone
          outside this organisation.
        </p>
        <h2 className="pt-2 font-medium">How long we keep it</h2>
        <p>
          Your responses are kept for {env.RETENTION_DAYS} days from the date you submit them, then
          deleted. You may ask us to delete them sooner by replying to the invitation email.
        </p>
      </div>
      <ConsentForm token={token} />
    </main>
  );
}
```

- [ ] **Step 3: Write `src/components/consent-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ConsentForm({ token }: { token: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    const response = await fetch("/api/candidate/consent", { method: "POST" });
    if (response.ok) {
      router.push(`/a/${token}/assessment`);
      return;
    }
    setBusy(false);
    router.push(`/a/${token}/done`);
  }

  return (
    <div className="mt-6 space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>I have read the above and agree to complete this self-assessment.</span>
      </label>
      <Button className="w-full" size="lg" disabled={!agreed || busy} onClick={begin}>
        {busy ? "Starting…" : "Start the assessment"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/app/api/candidate/consent/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireCandidate } from "@/lib/auth-candidate";
import { applyStatus } from "@/lib/status";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
  let candidate;
  try {
    candidate = await requireCandidate();
  } catch {
    return NextResponse.json({ error: "Assessment is not available" }, { status: 403 });
  }

  if (candidate.status === "STARTED") return NextResponse.json({ ok: true });

  const now = new Date();
  await applyStatus(candidate.id, "STARTED", { consentedAt: now, startedAt: now });
  await audit("candidate", "candidate.consented", candidate.id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Write `src/app/a/[token]/done/page.tsx`**

This page is the landing spot for used, expired, revoked and unknown tokens alike. It must not
distinguish between them.

```tsx
export const dynamic = "force-dynamic";

export default function DonePage() {
  return (
    <main className="mx-auto max-w-xl p-5">
      <h1 className="text-xl font-semibold">Thank you</h1>
      <p className="mt-4 text-sm leading-relaxed">
        If you have just submitted your self-assessment, we have received it and no further action
        is needed from you.
      </p>
      <p className="mt-3 text-sm leading-relaxed">
        If you were expecting to see questions, this link has already been used or is no longer
        active. Please reply to your invitation email and we will help.
      </p>
    </main>
  );
}
```

- [ ] **Step 6: Verify the flow by hand**

Run `pnpm dev`, invite a candidate, open the printed link.
Expected: the consent page renders, the checkbox gates the button, and opening the link a second
time after consenting goes straight to the assessment.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth-candidate.ts src/app/a src/app/api/candidate/consent src/components/consent-form.tsx
git commit -m "feat: add candidate auth, consent capture and the completion page"
```

---

## Task 12: The assessment page, autosave, and submit

**Files:**
- Create: `src/app/a/[token]/assessment/page.tsx`, `src/components/assessment-form.tsx`, `src/app/api/candidate/autosave/route.ts`, `src/app/api/candidate/submit/route.ts`

**Interfaces:**
- Consumes: `requireCandidate`, `resolveToken`, `currentCandidateId`, `score`, `applyStatus`, `audit`, `sendReceipt`
- Produces: a `Result` row per submitted candidate, and status `SCORED`.

- [ ] **Step 1: Write `src/app/a/[token]/assessment/page.tsx`**

This is where the token/cookie agreement rule is enforced.

```tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentCandidateId, resolveToken } from "@/lib/auth-candidate";
import { AssessmentForm } from "@/components/assessment-form";

export const dynamic = "force-dynamic";

export default async function AssessmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // The path token authenticates the page render.
  const candidate = await resolveToken(token);
  if (!candidate) redirect(`/a/${token}/done`);

  // The cookie authenticates the API calls this page will make. They must agree —
  // otherwise a stale cookie on a shared phone could answer for the wrong person.
  const cookieCandidateId = await currentCandidateId();
  if (cookieCandidateId !== candidate.id) redirect(`/a/${token}/done`);

  if (candidate.status !== "STARTED") redirect(`/a/${token}`);

  const [items, responses] = await Promise.all([
    db.item.findMany({ orderBy: { order: "asc" } }),
    db.response.findMany({ where: { candidateId: candidate.id } }),
  ]);

  const saved = Object.fromEntries(responses.map((r) => [r.itemId, r.value]));

  return (
    <AssessmentForm
      token={token}
      items={items.map((i) => ({ id: i.id, order: i.order, text: i.text }))}
      saved={saved}
    />
  );
}
```

- [ ] **Step 2: Write `src/components/assessment-form.tsx`**

Mobile-first: the scale is a row of five large tap targets, not a dropdown or a slider.

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Item = { id: string; order: number; text: string };

const LABELS = [
  "Strongly disagree", "Disagree", "Neither agree nor disagree", "Agree", "Strongly agree",
];

export function AssessmentForm({
  token, items, saved,
}: { token: string; items: Item[]; saved: Record<string, number> }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>(saved);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time spent on each item, accumulated locally and flushed with the answer.
  const shownAt = useRef<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const now = Date.now();
    for (const item of items) shownAt.current[item.id] ??= now;
  }, [items]);

  const flush = useCallback((itemId: string, value: number) => {
    const startedAt = shownAt.current[itemId] ?? Date.now();
    const msOnItem = Math.max(0, Date.now() - startedAt);
    shownAt.current[itemId] = Date.now();
    void fetch("/api/candidate/autosave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, value, msOnItem }),
      keepalive: true,
    });
  }, []);

  function choose(itemId: string, value: number) {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
    setMissing((prev) => prev.filter((id) => id !== itemId));
    clearTimeout(timers.current[itemId]);
    timers.current[itemId] = setTimeout(() => flush(itemId, value), 800);
  }

  const answered = Object.keys(answers).length;

  async function submit() {
    const unanswered = items.filter((i) => answers[i.id] === undefined).map((i) => i.id);
    if (unanswered.length > 0) {
      setMissing(unanswered);
      document.getElementById(`item-${unanswered[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setBusy(true);
    setError(null);
    // Flush any answer still inside its debounce window before submitting.
    for (const [itemId, value] of Object.entries(answers)) {
      clearTimeout(timers.current[itemId]);
      flush(itemId, value);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));

    const response = await fetch("/api/candidate/submit", { method: "POST" });
    if (response.ok) {
      router.push(`/a/${token}/done`);
      return;
    }
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (Array.isArray(body.unanswered)) setMissing(body.unanswered);
    setError(body.error ?? "Could not submit. Please try again.");
  }

  return (
    <main className="mx-auto max-w-xl p-4 pb-32">
      <h1 className="text-lg font-semibold">Your self-assessment</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        There are no right or wrong answers. Choose what is true of how you actually work.
      </p>

      <ol className="mt-6 space-y-8">
        {items.map((item) => {
          const isMissing = missing.includes(item.id);
          return (
            <li
              key={item.id}
              id={`item-${item.id}`}
              className={`rounded-lg border p-4 ${isMissing ? "border-red-500 bg-red-50" : "border-transparent"}`}
            >
              <p className="text-sm font-medium">
                <span className="mr-2 text-muted-foreground">{item.order}.</span>
                {item.text}
              </p>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((value) => {
                  const selected = answers[item.id] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${item.text} — ${LABELS[value - 1]}`}
                      aria-pressed={selected}
                      onClick={() => choose(item.id, value)}
                      className={`h-14 rounded-md border text-base font-medium transition ${
                        selected ? "border-slate-900 bg-slate-900 text-white" : "bg-white active:bg-slate-100"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>Strongly disagree</span><span>Strongly agree</span>
              </div>
              {isMissing && <p className="mt-2 text-xs text-red-600">Please answer this one.</p>}
            </li>
          );
        })}
      </ol>

      <div className="fixed inset-x-0 bottom-0 border-t bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-xl">
          {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
          <p className="mb-2 text-xs text-muted-foreground">{answered} of {items.length} answered</p>
          <Button className="w-full" size="lg" disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write `src/app/api/candidate/autosave/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCandidate } from "@/lib/auth-candidate";

export const runtime = "nodejs";

const bodySchema = z.object({
  itemId: z.string().min(1),
  value: z.number().int().min(1).max(5),
  msOnItem: z.number().int().min(0),
});

export async function POST(request: Request) {
  let candidate;
  try {
    candidate = await requireCandidate();
  } catch {
    return NextResponse.json({ error: "Assessment is not available" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answer" }, { status: 400 });

  const { itemId, value, msOnItem } = parsed.data;
  if (!(await db.item.findUnique({ where: { id: itemId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Unknown item" }, { status: 400 });
  }

  // msOnItem accumulates across visits so a resumed sitting adds to the earlier time.
  const existing = await db.response.findUnique({
    where: { candidateId_itemId: { candidateId: candidate.id, itemId } },
    select: { msOnItem: true },
  });

  await db.response.upsert({
    where: { candidateId_itemId: { candidateId: candidate.id, itemId } },
    update: { value, msOnItem: (existing?.msOnItem ?? 0) + msOnItem },
    create: { candidateId: candidate.id, itemId, value, msOnItem },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write `src/app/api/candidate/submit/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CANDIDATE_COOKIE, requireCandidate } from "@/lib/auth-candidate";
import { applyStatus } from "@/lib/status";
import { audit } from "@/lib/audit";
import { score, type ItemDef } from "@/lib/scoring";
import { sendReceipt } from "@/lib/email";

export const runtime = "nodejs";

export async function POST() {
  let candidate;
  try {
    candidate = await requireCandidate();
  } catch {
    return NextResponse.json({ error: "Assessment is not available" }, { status: 403 });
  }

  const [items, responses] = await Promise.all([
    db.item.findMany({ orderBy: { order: "asc" } }),
    db.response.findMany({ where: { candidateId: candidate.id } }),
  ]);

  const answeredIds = new Set(responses.map((r) => r.itemId));
  const unanswered = items.filter((i) => !answeredIds.has(i.id)).map((i) => i.id);
  if (unanswered.length > 0) {
    return NextResponse.json(
      { error: "Please answer every statement before submitting.", unanswered },
      { status: 400 },
    );
  }

  const scored = score(
    items as ItemDef[],
    responses.map((r) => ({ itemId: r.itemId, value: r.value, msOnItem: r.msOnItem })),
  );

  // Server-observed elapsed time, stored beside the self-reported total.
  const stamps = responses.map((r) => r.updatedAt.getTime());
  const serverWindowSeconds = Math.round((Math.max(...stamps) - Math.min(...stamps)) / 1000);

  const now = new Date();
  await applyStatus(candidate.id, "SUBMITTED", { submittedAt: now });

  await db.result.upsert({
    where: { candidateId: candidate.id },
    update: {
      dimensionScores: scored.dimensions,
      validityFlags: scored.flags,
      totalSeconds: scored.totalSeconds,
      serverWindowSeconds,
    },
    create: {
      candidateId: candidate.id,
      dimensionScores: scored.dimensions,
      validityFlags: scored.flags,
      totalSeconds: scored.totalSeconds,
      serverWindowSeconds,
    },
  });

  await applyStatus(candidate.id, "SCORED");
  await audit("candidate", "assessment.submitted", candidate.id, {
    itemCount: items.length,
    totalSeconds: scored.totalSeconds,
  });

  await sendReceipt(candidate.email, candidate.fullName);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CANDIDATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
```

Note that `Response` rows are read and never written here — recomputing a `Result` from the
responses alone stays possible, as the constraints require.

- [ ] **Step 5: Write the Playwright spec for the candidate walk**

`tests/e2e/02-candidate-flow.spec.ts`. It covers invite, consent, resume after closing the
browser, the unanswered-item rejection, and the used-link behaviour — spec §15 steps 2 to 4.

```ts
import { test, expect, type Page } from "@playwright/test";

const PASSWORD = process.env.ADMIN_PASSWORD!;

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Reads the invitation link out of the console transport's stdout. */
async function inviteAndCaptureLink(page: Page, name: string, email: string): Promise<string> {
  const links: string[] = [];
  page.on("console", () => {});
  await signIn(page);
  await page.goto("/admin/invite");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("status")).toContainText("Invited 1");
  // The dev server prints the link; tests read it from the server log file instead.
  const fs = await import("node:fs/promises");
  const log = await fs.readFile("server.log", "utf8").catch(() => "");
  const found = log.match(new RegExp(`http://localhost:3000/a/[A-Za-z0-9_-]+`, "g")) ?? [];
  links.push(...found);
  expect(links.length).toBeGreaterThan(0);
  return links[links.length - 1];
}

test("a candidate consents, answers, resumes after closing, and submits", async ({ page, context }) => {
  const link = await inviteAndCaptureLink(page, "Amira Yusof", `amira+${Date.now()}@example.com`);

  const candidate = await context.newPage();
  await candidate.goto(link);
  await expect(candidate.getByRole("heading", { name: "Before you begin" })).toBeVisible();

  await candidate.getByRole("checkbox").check();
  await candidate.getByRole("button", { name: "Start the assessment" }).click();
  await expect(candidate.getByRole("heading", { name: "Your self-assessment" })).toBeVisible();

  // Answer the first 17 items, then abandon the page.
  const groups = candidate.locator("li[id^='item-']");
  for (let i = 0; i < 17; i++) {
    await groups.nth(i).getByRole("button", { name: /Agree$/ }).first().click();
  }
  await candidate.waitForTimeout(1200); // let the debounce flush
  await candidate.close();

  // Reopen the same link — every prior answer must still be selected.
  const resumed = await context.newPage();
  await resumed.goto(link);
  await expect(resumed.getByRole("heading", { name: "Your self-assessment" })).toBeVisible();
  await expect(resumed.getByText("17 of 34 answered")).toBeVisible();

  // Submitting with items outstanding is rejected and the first gap is highlighted.
  await resumed.getByRole("button", { name: "Submit" }).click();
  await expect(resumed.getByText("Please answer this one.").first()).toBeVisible();

  const remaining = resumed.locator("li[id^='item-']");
  for (let i = 17; i < 34; i++) {
    await remaining.nth(i).getByRole("button", { name: /Agree$/ }).first().click();
  }
  await resumed.waitForTimeout(1200);
  await resumed.getByRole("button", { name: "Submit" }).click();
  await expect(resumed).toHaveURL(/\/done$/);

  // The link now lands on the completion page, not the questions.
  await resumed.goto(link);
  await expect(resumed).toHaveURL(/\/done$/);
  await expect(resumed.getByRole("heading", { name: "Thank you" })).toBeVisible();
});
```

- [ ] **Step 6: Make the server log readable by the test**

Change `playwright.config.ts`'s `webServer.command` so stdout is captured:

```ts
  webServer: {
    command: "pnpm build && pnpm start > server.log 2>&1",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
```

Add `server.log` to `.gitignore`.

- [ ] **Step 7: Run the spec**

Run: `pnpm test:e2e tests/e2e/02-candidate-flow.spec.ts`
Expected: 1 passed. This is the spec §11 Phase 5 "Done when" gate. Paste the output.

- [ ] **Step 8: Commit**

```bash
git add src/app/a src/app/api/candidate src/components/assessment-form.tsx playwright.config.ts .gitignore tests
git commit -m "feat: add assessment form with autosave, resume and scored submission"
```

---

## Task 13: The result profile page

**Files:**
- Create: `src/app/admin/candidate/[id]/page.tsx`, `src/components/dimension-bar.tsx`, `src/components/item-responses-table.tsx`
- Modify: `src/app/globals.css` (print rules)

**Interfaces:**
- Consumes: `requireAdmin`, `db`, `audit`, and the stored `dimensionScores` / `validityFlags` JSON.

- [ ] **Step 1: Write `src/components/dimension-bar.tsx`**

```tsx
const NAMES: Record<string, string> = {
  WER: "Work ethic and reliability",
  COM: "Communication and collaboration",
  PSL: "Problem solving and learning agility",
  ADR: "Adaptability and resilience",
  INA: "Integrity and accountability",
};

export function DimensionBar({
  code, scaled, band,
}: { code: string; scaled: number; band: string }) {
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{NAMES[code] ?? code}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{scaled} · {band}</span>
      </div>
      <div className="mt-2 h-3 w-full rounded-full bg-slate-200 print:border print:border-slate-400">
        <div
          className="h-3 rounded-full bg-slate-800 print:bg-slate-700"
          style={{ width: `${Math.max(2, scaled)}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/item-responses-table.tsx`**

```tsx
"use client";

import { useState } from "react";

type Row = { order: number; text: string; value: number; dimension: string };

export function ItemResponsesTable({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm underline print:hidden"
      >
        {open ? "Hide" : "Show"} item-level responses
      </button>
      <div className={open ? "mt-4" : "mt-4 hidden print:block"}>
        <table className="w-full text-left text-xs">
          <thead className="border-b text-muted-foreground">
            <tr><th className="py-1.5">#</th><th>Statement</th><th>Dimension</th><th>Answer</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.order} className="border-b">
                <td className="py-1.5">{row.order}</td>
                <td>{row.text}</td>
                <td>{row.dimension}</td>
                <td className="tabular-nums">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Write `src/app/admin/candidate/[id]/page.tsx`**

Flags render as neutral informational chips, never as warnings, and the timing chip says who
reported the time.

```tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { DimensionBar } from "@/components/dimension-bar";
import { ItemResponsesTable } from "@/components/item-responses-table";
import type { DimensionScore, ValidityFlag } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const FLAG_NAMES: Record<string, string> = {
  impressionManagement: "Impression management",
  inconsistentResponding: "Consistency",
  straightLining: "Answer variation",
  rushed: "Time on task",
};

export default async function CandidateResultPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const candidate = await db.candidate.findUnique({
    where: { id },
    include: { result: true, responses: { include: { item: true } } },
  });
  if (!candidate?.result) notFound();

  await audit("admin", "result.viewed", id);

  const dimensions = candidate.result.dimensionScores as unknown as DimensionScore[];
  const flags = candidate.result.validityFlags as unknown as ValidityFlag[];

  const rows = candidate.responses
    .map((r) => ({ order: r.item.order, text: r.item.text, value: r.value, dimension: r.item.dimension }))
    .sort((a, b) => a.order - b.order);

  const minutes = Math.round(candidate.result.totalSeconds / 60);
  const serverMinutes = Math.round(candidate.result.serverWindowSeconds / 60);

  return (
    <main className="mx-auto max-w-3xl p-6 print:p-0">
      <header>
        <h1 className="text-2xl font-semibold">{candidate.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          {candidate.email} · submitted {candidate.submittedAt?.toLocaleDateString("en-GB")}
        </p>
        <p className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 print:bg-transparent print:p-0">
          This profile is a self-report and is one input into a hiring decision. It is not a test
          score, a ranking, or a recommendation.
        </p>
      </header>

      <section className="mt-6 divide-y">
        {dimensions.map((d) => (
          <DimensionBar key={d.code} code={d.code} scaled={d.scaled} band={d.band} />
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Response validity</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Context for reading the profile above. These do not change any score.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {flags.map((f) => (
            <span
              key={f.code}
              className={`rounded-full border px-3 py-1 text-xs ${
                f.triggered ? "border-slate-800 bg-slate-100" : "border-slate-200 text-muted-foreground"
              }`}
            >
              <span className="font-medium">{FLAG_NAMES[f.code] ?? f.code}:</span> {f.reason}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Self-reported time on task: {minutes} minute{minutes === 1 ? "" : "s"}. Elapsed time
          observed by the server: {serverMinutes} minute{serverMinutes === 1 ? "" : "s"}.
        </p>
      </section>

      <ItemResponsesTable rows={rows} />
    </main>
  );
}
```

- [ ] **Step 4: Add print rules to `src/app/globals.css`**

```css
@media print {
  nav, header nav, .print\:hidden { display: none !important; }
  body { background: #fff; font-size: 11pt; }
  main { max-width: none; padding: 0; }
  @page { margin: 14mm; }
}
```

- [ ] **Step 5: Add the Playwright spec**

`tests/e2e/03-results.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const PASSWORD = process.env.ADMIN_PASSWORD!;

test("a scored candidate's profile shows five dimensions and four flags", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByRole("link", { name: /.+/ }).filter({ hasNotText: "Invite" }).first().click();
  await expect(page).toHaveURL(/\/admin\/candidate\//);

  await expect(page.getByText("Work ethic and reliability")).toBeVisible();
  await expect(page.getByText("Integrity and accountability")).toBeVisible();
  await expect(page.getByText("Impression management:")).toBeVisible();
  await expect(page.getByText("Time on task:")).toBeVisible();
  await expect(page.getByText(/one input into a hiring decision/)).toBeVisible();

  await page.getByRole("button", { name: /Show item-level responses/ }).click();
  await expect(page.getByRole("cell", { name: "I complete tasks by the deadline I commit to." })).toBeVisible();
});
```

- [ ] **Step 6: Run it, then verify the print layout by hand**

Run: `pnpm test:e2e tests/e2e/03-results.spec.ts`
Expected: 1 passed.

Then open a profile in a browser and press `Ctrl+P`.
Expected: no navigation chrome, the item table expanded, one clean page. This is the spec §11
Phase 6 "Done when" gate.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/candidate src/components src/app/globals.css tests
git commit -m "feat: add candidate result profile with print stylesheet"
```

---

## Task 14: CSV export, deletion, and purge

**Files:**
- Create: `src/app/api/admin/export/route.ts`, `src/app/api/admin/candidate/[id]/route.ts`, `src/app/api/admin/purge/route.ts`, `src/components/danger-zone.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin`, `db`, `audit`, `env`
- Produces: `GET /api/admin/export` → `text/csv`; `DELETE /api/admin/candidate/[id]`; `POST /api/admin/purge`.

- [ ] **Step 1: Write `src/app/api/admin/export/route.ts`**

The leading-character guard stops a value like `=cmd()` from being executed by Excel when the
file is opened.

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { DimensionScore, ValidityFlag } from "@/lib/scoring";
import { COMPETENCY_CODES } from "@/lib/scoring";

export const runtime = "nodejs";

const FLAG_CODES = [
  "impressionManagement", "inconsistentResponding", "straightLining", "rushed",
] as const;

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  const candidates = await db.candidate.findMany({
    orderBy: { createdAt: "asc" },
    include: { result: true },
  });

  const header = [
    "email", "full_name", "status", "submitted_at",
    ...COMPETENCY_CODES.map((c) => `${c.toLowerCase()}_scaled`),
    ...FLAG_CODES.map((f) => `flag_${f}`),
  ];

  const rows = candidates.map((c) => {
    const dimensions = (c.result?.dimensionScores ?? []) as unknown as DimensionScore[];
    const flags = (c.result?.validityFlags ?? []) as unknown as ValidityFlag[];
    return [
      c.email,
      c.fullName,
      c.status,
      c.submittedAt?.toISOString() ?? "",
      ...COMPETENCY_CODES.map((code) => dimensions.find((d) => d.code === code)?.scaled ?? ""),
      ...FLAG_CODES.map((code) => (flags.find((f) => f.code === code)?.triggered ? "yes" : "no")),
    ];
  });

  await audit("admin", "export.downloaded", undefined, { rowCount: rows.length });

  // The BOM makes Excel read the file as UTF-8 rather than the local codepage.
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="afenda-talents-results.csv"',
    },
  });
}
```

There is no overall score column — that is deliberate, and adding one would violate the
constraint against a single summary number.

- [ ] **Step 2: Write `src/app/api/admin/candidate/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await db.candidate.findUnique({ where: { id }, select: { id: true } });
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Responses and the result cascade from the schema's onDelete rules.
  await db.candidate.delete({ where: { id } });
  await audit("admin", "candidate.deleted", id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Write `src/app/api/admin/purge/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const CONFIRMATION = "DELETE ALL CANDIDATE DATA";
const bodySchema = z.object({ confirmation: z.string() });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmation !== CONFIRMATION) {
    return NextResponse.json({ error: `Type exactly: ${CONFIRMATION}` }, { status: 400 });
  }

  const { count } = await db.candidate.deleteMany({});

  // Audit rows survive as proof the purge happened. They hold no names or emails,
  // so nothing identifying remains after this call.
  await audit("admin", "data.purged", undefined, { deletedCount: count });

  return NextResponse.json({ deleted: count });
}
```

- [ ] **Step 4: Write `src/components/danger-zone.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CONFIRMATION = "DELETE ALL CANDIDATE DATA";

export function DangerZone({ retentionDays }: { retentionDays: number }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function purge() {
    setBusy(true);
    const response = await fetch("/api/admin/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? `Deleted ${body.deleted} candidate record(s).` : body.error);
    setConfirmation("");
    router.refresh();
  }

  return (
    <section className="mt-12 rounded-lg border border-red-200 p-4 print:hidden">
      <h2 className="text-sm font-medium text-red-800">Delete candidate data</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Candidates were told their responses are kept for {retentionDays} days from submission.
        Honouring that is a manual step — this is how you do it. Names, emails, answers and results
        are removed permanently. The audit log keeps a record that the deletion happened, with no
        personal data in it.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          aria-label="Confirmation phrase"
          placeholder={CONFIRMATION}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        <Button
          variant="destructive"
          disabled={busy || confirmation !== CONFIRMATION}
          onClick={purge}
        >
          {busy ? "Deleting…" : "Delete all candidate data"}
        </Button>
      </div>
      {message && <p role="status" className="mt-2 text-xs">{message}</p>}
    </section>
  );
}
```

- [ ] **Step 5: Wire the export link and danger zone into `src/app/admin/page.tsx`**

Add to the imports:

```tsx
import { env } from "@/lib/env";
import { DangerZone } from "@/components/danger-zone";
```

Add an export button beside "Invite candidates":

```tsx
        <div className="flex gap-2">
          <Button asChild variant="outline"><a href="/api/admin/export">Export CSV</a></Button>
          <Button asChild><Link href="/admin/invite">Invite candidates</Link></Button>
        </div>
```

And render the danger zone at the end of `<main>`:

```tsx
      <DangerZone retentionDays={env.RETENTION_DAYS} />
```

- [ ] **Step 6: Write the Playwright spec**

`tests/e2e/04-export-and-audit.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const PASSWORD = process.env.ADMIN_PASSWORD!;
const db = new PrismaClient();

test.afterAll(async () => { await db.$disconnect(); });

test("the CSV export has a header and one row per candidate", async ({ page, request }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  const response = await page.request.get("/api/admin/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");

  const csv = await response.text();
  const lines = csv.trim().split("\r\n");
  const expected = await db.candidate.count();

  expect(lines[0]).toContain("email");
  expect(lines[0]).toContain("wer_scaled");
  expect(lines[0]).toContain("flag_rushed");
  expect(lines[0]).not.toContain("overall");
  expect(lines.length - 1).toBe(expected);
});

test("no audit row contains a raw token, an email, or a name", async () => {
  const events = await db.auditEvent.findMany();
  expect(events.length).toBeGreaterThan(0);

  const candidates = await db.candidate.findMany({ select: { email: true, fullName: true } });
  const serialised = JSON.stringify(events);

  expect(serialised).not.toMatch(/[^\s@"]+@[^\s@"]+\.[^\s@"]+/);
  for (const c of candidates) {
    expect(serialised).not.toContain(c.email);
    expect(serialised).not.toContain(c.fullName);
  }
  // No stored value looks like a 32-byte base64url token.
  expect(serialised).not.toMatch(/[A-Za-z0-9_-]{43}/);
});

test("the audit log records every action from the end-to-end run", async () => {
  const actions = new Set((await db.auditEvent.findMany({ select: { action: true } })).map((e) => e.action));
  for (const action of [
    "admin.login", "invite.created", "invite.revoked",
    "candidate.consented", "assessment.submitted", "result.viewed", "export.downloaded",
  ]) {
    expect(actions).toContain(action);
  }
});
```

- [ ] **Step 7: Add the revoke and resend spec**

`tests/e2e/05-revoke-resend.spec.ts` — spec §15 steps 6 and 7:

```ts
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";

const PASSWORD = process.env.ADMIN_PASSWORD!;

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function latestLink(): Promise<string> {
  const log = await fs.readFile("server.log", "utf8");
  const links = log.match(/http:\/\/localhost:3000\/a\/[A-Za-z0-9_-]+/g) ?? [];
  return links[links.length - 1];
}

test("a revoked invitation stops working", async ({ page, context }) => {
  await signIn(page);
  await page.goto("/admin/invite");
  await page.getByLabel("Full name").fill("Bilal Rahman");
  await page.getByLabel("Email").fill(`bilal+${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("status")).toContainText("Invited 1");

  const link = await latestLink();

  await page.goto("/admin");
  const row = page.getByRole("row", { name: /Bilal Rahman/ });
  await row.getByRole("button", { name: "Revoke" }).click();
  await expect(row.getByText("REVOKED")).toBeVisible();

  const candidate = await context.newPage();
  await candidate.goto(link);
  await expect(candidate).toHaveURL(/\/done$/);
});

test("resending invalidates the old link and issues a working one", async ({ page, context }) => {
  await signIn(page);
  await page.goto("/admin/invite");
  await page.getByLabel("Full name").fill("Chen Wei");
  await page.getByLabel("Email").fill(`chen+${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("status")).toContainText("Invited 1");

  const original = await latestLink();

  await page.goto("/admin");
  await page.getByRole("row", { name: /Chen Wei/ }).getByRole("button", { name: "Resend" }).click();
  await page.waitForTimeout(500);
  const replacement = await latestLink();
  expect(replacement).not.toBe(original);

  const candidate = await context.newPage();
  await candidate.goto(original);
  await expect(candidate).toHaveURL(/\/done$/);

  await candidate.goto(replacement);
  await expect(candidate.getByRole("heading", { name: "Before you begin" })).toBeVisible();
});
```

- [ ] **Step 8: Run the whole suite**

```bash
pnpm test
pnpm test:e2e
```

Expected: all unit tests pass; all five e2e spec files pass. This is the spec §11 Phase 7
"Done when" gate. Paste both outputs.

- [ ] **Step 9: Open the CSV in a spreadsheet to confirm it is clean**

Download the export and open it in Excel or LibreOffice.
Expected: one header row, correct statuses, no mojibake in names, no formula execution.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/admin src/app/admin src/components/danger-zone.tsx tests
git commit -m "feat: add CSV export, candidate deletion, purge, and audit coverage"
```

---

## Task 15: Deploy to Vercel

**Files:**
- Create: `README.md` deployment section

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Generate the production admin password and app secret**

```bash
node -e "console.log('APP_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ADMIN_PASSWORD=' + require('crypto').randomBytes(24).toString('base64url'))"
```

Store both in a password manager. The `ADMIN_PASSWORD` must be generated, not chosen — it is
the primary defence against a distributed guessing attempt, and `lib/env.ts` refuses anything
under 24 characters at boot.

- [ ] **Step 2: Create the Vercel project and set environment variables**

In the Vercel dashboard, import the repository and set, for the Production environment:
`DATABASE_URL` (Neon **pooled**), `DIRECT_URL` (Neon **direct**), `APP_URL` (the real https
host), `APP_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RESEND_API_KEY`, `MAIL_FROM`,
`INVITE_TTL_DAYS`, `RETENTION_DAYS`.

There is no Dockerfile and no persistent volume — the database is Neon.

- [ ] **Step 3: Verify the domain in Resend**

Add and verify the sending domain, then set `MAIL_FROM` to an address on it. An unverified
domain silently degrades deliverability and candidates will not receive their links.

- [ ] **Step 4: Apply migrations and seed production**

```bash
pnpm dotenv -e .env.production -- prisma migrate deploy
pnpm dotenv -e .env.production -- prisma db seed
```

Expected: `Seeded instrument. Item count: 34`

- [ ] **Step 5: Measure the cold start**

Leave the deployment idle for 15 minutes so Neon autosuspends, then load a candidate link on a
phone over mobile data and time it with a stopwatch.

Record the number in `DECISIONS.md` under D11. If the first paint takes more than about five
seconds, either move Neon to a paid tier that does not autosuspend, or accept it knowingly and
write down that you did. This must not be discovered by a candidate.

- [ ] **Step 6: Walk the full acceptance script on the deployed instance**

Work through spec §15 steps 1–9 by hand against production, using three real addresses you
control. The Playwright suite covers the same ground, but this is the run that proves the real
host, the real database, the real email provider and a real phone work together.

- [ ] **Step 7: Verify no route is reachable unauthenticated**

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://YOUR_HOST/admin
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/api/admin/export
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/api/candidate/submit
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/a/not-a-real-token
```

Expected: `307` to `/admin/login`, `401`, `401`, and a redirect to the completion page. This is
constraint 1 of the global constraints, verified for the last time.

- [ ] **Step 8: Commit and tag**

```bash
git add README.md DECISIONS.md
git commit -m "docs: add deployment runbook and record measured cold start"
git tag -a v1.0.0 -m "Afenda Talents MVP"
```

---

## Coverage Check

| Spec section | Covered by |
|---|---|
| §1 two views, no public signup | Tasks 8, 11; verified Task 15 step 7 |
| §2 stack | Task 1; datasource amended per D1 |
| §3 data model, status values, transitions | Tasks 2, 5 |
| §4 the instrument, fixed order | Task 3 |
| §5 scoring, bands, four flags | Task 4 |
| §6 admin auth, candidate tokens, proxy gate | Tasks 8, 11 |
| §7 every route | Tasks 8, 10, 11, 12, 13, 14 |
| §8 email templates, console transport | Task 9; reminder dropped per D12 (Task 10 step 7) |
| §9 environment, fail fast | Task 6 |
| §10 file tree | Task 1 onward; Dockerfile omitted per D1 |
| §11 phases and Done-when gates | Tasks 3, 4, 8, 10, 12, 13, 14, 15 |
| §12 non-goals | Global constraints; enforced by the build skill |
| §13 constraints 1–8 plus the ninth | Global constraints; Tasks 5, 7, 11, 12, 14 |
| §14 CLAUDE.md | Written before this plan |
| §15 acceptance, all nine steps | Tasks 8, 12, 13, 14 (automated); Task 15 step 6 (by hand) |

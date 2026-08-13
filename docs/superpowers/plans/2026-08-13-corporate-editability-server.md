# Corporate Editability (Server Layer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the five create-only Corporate entities an edit-and-deactivate endpoint, so a mistaken site, contact, coverage row, obligation party or obligation-site link can be corrected or stood down instead of being permanent.

**Architecture:** Each entity gets one `PATCH` endpoint taking a discriminated union on `action` — `UPDATE` for field edits, `SET_ACTIVE` for deactivation — mirroring the existing `patchObligationLineSchema` pattern. Two link tables gain an `isActive` column so all five deactivate identically. Nothing is ever deleted, consistent with Corporate having no `DELETE` handler anywhere.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 + PostgreSQL (Neon), Zod 4, Vitest, TypeScript.

**Follows on from:** the audit in this session. There is no separate design spec; the one policy decision (deactivate rather than delete) was taken explicitly and is recorded in Task 7.

## Global Constraints

- Zod-validate every API body (`AGENTS.md`).
- Non-Talents domains use `requireWorkspaceAdmin()` / `requireWorkspaceUser()` from `lib/auth-workspace.ts`, never `requireAdmin()`.
- Every request-level gate is coarse; every handler re-checks database-backed authority before acting.
- `AuditEvent` never stores a name or an email — ids and non-identifying meta only.
- Acting corporate identities come from the authenticated session, never from client-submitted fields.
- Corporate custom fields are validated server-side through `validateAdministrativeCustomFields`. Do not accept unknown ad-hoc JSON keys.
- Corporate Administration does not become accounting (D19 boundary).
- Nothing in Corporate deletes. No `DELETE` handler may be added by this plan.
- Unit tests run with `environment: "node"` and match only `tests/unit/**/*.test.ts`. There is no React component-test harness — do not write one.
- Run `pnpm lint && pnpm typecheck && pnpm test` before declaring any task done, and paste the output.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `prisma/schema.prisma` | `isActive` on `AdministrativeObligationParty` and `AdministrativeObligationSite`. | 1 |
| `prisma/migrations/20260813080000_add_link_is_active/migration.sql` | Add both columns, defaulted true. | 1 |
| `src/lib/corporate-admin/update-schemas.ts` | All five patch schemas. Pure, no Prisma. | 2–6 |
| `tests/unit/corporate-patch-schemas.test.ts` | Tests for all five patch schemas. | 2–6 |
| `src/app/api/admin/corporate/sites/[id]/route.ts` | Site edit + deactivate. | 2 |
| `src/app/api/admin/corporate/counterparties/[id]/contacts/[contactId]/route.ts` | Contact edit + deactivate. | 3 |
| `src/app/api/admin/corporate/sites/[id]/coverage/[coverageId]/route.ts` | Coverage edit + deactivate. | 4 |
| `src/app/api/admin/corporate/obligations/[id]/parties/route.ts` | Party edit + deactivate — `PATCH` added beside the existing `POST`. | 5 |
| `src/app/api/admin/corporate/obligations/[id]/sites/[siteId]/route.ts` | Obligation-site link edit + deactivate. | 6 |

**Composite primary keys.** `AdministrativeObligationParty` is keyed `@@id([obligationId, counterpartyId, roleCode])` and `AdministrativeObligationSite` is keyed `@@id([obligationId, siteId])`. Neither has an `id` column, so neither can be addressed by one. Prisma exposes them as `obligationId_counterpartyId_roleCode` and `obligationId_siteId`. Two consequences: the party endpoint takes its selector in the body rather than the URL, because a role code is free text and would need escaping in a path segment; and `roleCode` and `counterpartyId` are **not editable** on a party, nor `siteId` on a link, because they are the key itself.
| `DECISIONS.md`, `docs/ui/` | Record the deactivate-not-delete policy. | 7 |

Tasks 2–6 each append one schema to `update-schemas.ts` and one describe block to `tests/unit/corporate-patch-schemas.test.ts`. They touch the same two files but are independently reviewable: a reviewer can reject the coverage endpoint while approving the site endpoint.

**Shared route shape.** Every endpoint in Tasks 2–6 follows the template established by `obligations/[id]/lines/[lineId]/route.ts`: `requireWorkspaceAdmin` in a try/catch returning 403, `safeParse` returning 400, a scoped `findFirst` returning 404, then the update plus `audit(...)` inside a transaction. The code is repeated per task rather than abstracted, because that is how this codebase writes route handlers.

---

### Task 1: Give the two link tables an active flag

`AdministrativeObligationParty` has only `effectiveTo`; `AdministrativeObligationSite` has no removal affordance at all. Both need `isActive` so all five entities stand down the same way.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260813080000_add_link_is_active/migration.sql`
- Test: `tests/unit/corporate-link-active.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `AdministrativeObligationParty.isActive` and `AdministrativeObligationSite.isActive`, both `Boolean @default(true)`, non-null.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/corporate-link-active.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Corporate never deletes. A link attached by mistake is stood down with isActive,
 * so both link tables must carry the flag the other entities already have.
 */
describe("Obligation link tables can be stood down", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

  function model(name: string): string {
    const start = schema.indexOf(`model ${name} {`);
    return schema.slice(start, schema.indexOf("\n}", start));
  }

  it("gives obligation parties an active flag", () => {
    expect(model("AdministrativeObligationParty")).toMatch(/isActive\s+Boolean\s+@default\(true\)/);
  });

  it("gives obligation site links an active flag", () => {
    expect(model("AdministrativeObligationSite")).toMatch(/isActive\s+Boolean\s+@default\(true\)/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/corporate-link-active.test.ts`

Expected: FAIL, 2 failures — neither model has the field.

- [ ] **Step 3: Add the columns to the schema**

In `prisma/schema.prisma`, inside `model AdministrativeObligationParty`, add this line immediately after the `effectiveTo` field:

```prisma
  isActive      Boolean   @default(true)
```

Inside `model AdministrativeObligationSite`, add this line immediately after the `scopeRole` field:

```prisma
  isActive   Boolean @default(true)
```

- [ ] **Step 4: Write the migration**

Confirm the newest existing migration first so the timestamp sorts last.

Run: `ls prisma/migrations`

At the time of writing the newest is `20260813070000_allow_multiple_due_items_per_date`. If a newer one exists, choose a later timestamp and rename the directory to match.

Create `prisma/migrations/20260813080000_add_link_is_active/migration.sql`:

```sql
-- Corporate never deletes. A link attached in error is stood down, not removed, so both
-- link tables gain the active flag the other Corporate entities already carry.
-- Existing rows are live links and default to true.
ALTER TABLE "AdministrativeObligationParty" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AdministrativeObligationSite" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
```

- [ ] **Step 5: Validate and regenerate**

Run: `DATABASE_URL="postgresql://test:test@localhost:5432/test" DIRECT_URL="postgresql://test:test@localhost:5432/test" pnpm prisma validate && pnpm prisma generate`

Expected: "The schemas at prisma are valid 🚀" then a successful client generation.

The dummy URLs are required because `prisma.config.ts` refuses to load without them. Do not run `pnpm prisma migrate dev` — it needs a live database, and `vercel-build` runs `pnpm db:deploy` on production.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/corporate-link-active.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 7: Run the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: lint and typecheck silent, all tests pass. Paste the output.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/unit/corporate-link-active.test.ts
git commit -m "Let obligation links be stood down"
```

---

### Task 2: Site edit and deactivate

**Files:**
- Modify: `src/lib/corporate-admin/update-schemas.ts`
- Create: `src/app/api/admin/corporate/sites/[id]/route.ts`
- Test: `tests/unit/corporate-patch-schemas.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `patchSiteSchema`, a `z.discriminatedUnion("action", …)` accepting `{ action: "SET_ACTIVE", isActive: boolean }` or `{ action: "UPDATE", … }`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/corporate-patch-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { patchSiteSchema } from "@/lib/corporate-admin/update-schemas";

describe("patchSiteSchema", () => {
  it("accepts a deactivation", () => {
    expect(patchSiteSchema.safeParse({ action: "SET_ACTIVE", isActive: false }).success).toBe(true);
  });

  it("accepts a field edit", () => {
    const parsed = patchSiteSchema.safeParse({
      action: "UPDATE",
      name: "Klang Headquarters",
      type: "OFFICE",
      city: "Klang",
      customFields: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown action", () => {
    expect(patchSiteSchema.safeParse({ action: "DELETE" }).success).toBe(false);
  });

  it("requires a name on update", () => {
    expect(patchSiteSchema.safeParse({ action: "UPDATE", type: "OFFICE", customFields: {} }).success).toBe(false);
  });

  it("accepts a blank code so it keeps the generated one", () => {
    const parsed = patchSiteSchema.safeParse({
      action: "UPDATE",
      code: "",
      name: "Klang Headquarters",
      type: "OFFICE",
      customFields: {},
    });
    expect(parsed.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/corporate-patch-schemas.test.ts`

Expected: FAIL — `update-schemas` has no export `patchSiteSchema`.

- [ ] **Step 3: Add the schema**

Append to `src/lib/corporate-admin/update-schemas.ts`:

```ts
const setActive = z.object({ action: z.literal("SET_ACTIVE"), isActive: z.boolean() });

export const patchSiteSchema = z.discriminatedUnion("action", [
  setActive,
  z.object({
    action: z.literal("UPDATE"),
    code: z.string().trim().min(2).max(50).optional().nullable().or(z.literal("")),
    name: z.string().trim().min(1).max(240),
    type: z.string().trim().min(1).max(100),
    organization: z.string().trim().max(160).optional().nullable(),
    addressLine1: z.string().trim().max(500).optional().nullable(),
    addressLine2: z.string().trim().max(500).optional().nullable(),
    city: z.string().trim().max(160).optional().nullable(),
    stateRegion: z.string().trim().max(160).optional().nullable(),
    postalCode: z.string().trim().max(40).optional().nullable(),
    countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a 2-letter country code").optional().nullable().or(z.literal("")),
    timezone: z.string().trim().max(100).optional().nullable(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    notes: z.string().trim().max(10_000).optional().nullable(),
    customFields: z.record(z.string(), z.unknown()).default({}),
  }),
]);
```

`isActive` is deliberately absent from `UPDATE` — activation state changes only through `SET_ACTIVE`, so an edit form cannot silently flip it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/corporate-patch-schemas.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 5: Create the endpoint**

Create `src/app/api/admin/corporate/sites/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import { cleanOptionalString } from "@/lib/corporate-admin/domain";
import { patchSiteSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = patchSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid site update" }, { status: 400 });

  const { id } = await context.params;
  const site = await db.administrativeSite.findUnique({ where: { id }, select: { id: true } });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  try {
    const updated = await db.$transaction(async (tx) => {
      if (parsed.data.action === "SET_ACTIVE") {
        const record = await tx.administrativeSite.update({ where: { id }, data: { isActive: parsed.data.isActive } });
        await audit(session.userId, "corporate.site.updated", id, { siteId: id, action: "SET_ACTIVE", isActive: parsed.data.isActive }, tx);
        return record;
      }

      const customFields = await validateAdministrativeCustomFields("SITE", parsed.data.customFields, tx);
      const record = await tx.administrativeSite.update({
        where: { id },
        data: {
          code: cleanOptionalString(parsed.data.code) ?? undefined,
          name: parsed.data.name,
          type: parsed.data.type,
          organization: cleanOptionalString(parsed.data.organization),
          addressLine1: cleanOptionalString(parsed.data.addressLine1),
          addressLine2: cleanOptionalString(parsed.data.addressLine2),
          city: cleanOptionalString(parsed.data.city),
          stateRegion: cleanOptionalString(parsed.data.stateRegion),
          postalCode: cleanOptionalString(parsed.data.postalCode),
          countryCode: cleanOptionalString(parsed.data.countryCode)?.toUpperCase() ?? null,
          timezone: cleanOptionalString(parsed.data.timezone),
          latitude: parsed.data.latitude ?? null,
          longitude: parsed.data.longitude ?? null,
          notes: cleanOptionalString(parsed.data.notes),
          customFields,
        },
      });
      await audit(session.userId, "corporate.site.updated", id, { siteId: id, action: "UPDATE" }, tx);
      return record;
    });

    return NextResponse.json({ site: { id: updated.id, code: updated.code } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update site";
    const conflict = /unique constraint/i.test(message);
    return NextResponse.json({ error: conflict ? "Site code already exists" : message }, { status: conflict ? 409 : 400 });
  }
}
```

`cleanOptionalString(code) ?? undefined` keeps the existing code when the field is blank — `undefined` tells Prisma to leave the column alone, which is what "auto-generated, do not change" means on edit.

- [ ] **Step 6: Run the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: all pass. Paste the output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/corporate-admin/update-schemas.ts "src/app/api/admin/corporate/sites/[id]/route.ts" tests/unit/corporate-patch-schemas.test.ts
git commit -m "Let sites be edited and stood down"
```

---

### Task 3: Counterparty contact edit and deactivate

**Files:**
- Modify: `src/lib/corporate-admin/update-schemas.ts`
- Create: `src/app/api/admin/corporate/counterparties/[id]/contacts/[contactId]/route.ts`
- Test: `tests/unit/corporate-patch-schemas.test.ts` (append a describe block)

**Interfaces:**
- Consumes: the `setActive` const defined in Task 2.
- Produces: `patchCounterpartyContactSchema`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/corporate-patch-schemas.test.ts`, and add `patchCounterpartyContactSchema` to the existing import from `@/lib/corporate-admin/update-schemas`:

```ts
describe("patchCounterpartyContactSchema", () => {
  it("accepts a deactivation", () => {
    expect(patchCounterpartyContactSchema.safeParse({ action: "SET_ACTIVE", isActive: false }).success).toBe(true);
  });

  it("accepts a field edit", () => {
    expect(patchCounterpartyContactSchema.safeParse({
      action: "UPDATE",
      name: "Siti Rahman",
      email: "siti@example.com",
      isPrimary: true,
    }).success).toBe(true);
  });

  it("accepts a blank email, because the field is optional in the form", () => {
    expect(patchCounterpartyContactSchema.safeParse({
      action: "UPDATE",
      name: "Siti Rahman",
      email: "",
      isPrimary: false,
    }).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(patchCounterpartyContactSchema.safeParse({
      action: "UPDATE",
      name: "Siti Rahman",
      email: "not-an-email",
      isPrimary: false,
    }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/corporate-patch-schemas.test.ts`

Expected: FAIL — no export `patchCounterpartyContactSchema`.

- [ ] **Step 3: Add the schema**

Append to `src/lib/corporate-admin/update-schemas.ts`:

```ts
export const patchCounterpartyContactSchema = z.discriminatedUnion("action", [
  setActive,
  z.object({
    action: z.literal("UPDATE"),
    name: z.string().trim().min(1).max(240),
    jobTitle: z.string().trim().max(500).optional().nullable(),
    department: z.string().trim().max(500).optional().nullable(),
    email: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
    phone: z.string().trim().max(500).optional().nullable(),
    mobile: z.string().trim().max(500).optional().nullable(),
    role: z.string().trim().max(500).optional().nullable(),
    isPrimary: z.boolean().default(false),
    notes: z.string().trim().max(10_000).optional().nullable(),
  }),
]);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/corporate-patch-schemas.test.ts`

Expected: PASS, 9 tests total.

- [ ] **Step 5: Create the endpoint**

Create `src/app/api/admin/corporate/counterparties/[id]/contacts/[contactId]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString } from "@/lib/corporate-admin/domain";
import { patchCounterpartyContactSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; contactId: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = patchCounterpartyContactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid contact update" }, { status: 400 });

  const { id: counterpartyId, contactId } = await context.params;
  const contact = await db.administrativeCounterpartyContact.findFirst({ where: { id: contactId, counterpartyId }, select: { id: true } });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  try {
    await db.$transaction(async (tx) => {
      if (parsed.data.action === "SET_ACTIVE") {
        await tx.administrativeCounterpartyContact.update({ where: { id: contactId }, data: { isActive: parsed.data.isActive } });
        await audit(session.userId, "corporate.counterparty_contact.updated", contactId, { counterpartyId, contactId, action: "SET_ACTIVE", isActive: parsed.data.isActive }, tx);
        return;
      }

      await tx.administrativeCounterpartyContact.update({
        where: { id: contactId },
        data: {
          name: parsed.data.name,
          jobTitle: cleanOptionalString(parsed.data.jobTitle),
          department: cleanOptionalString(parsed.data.department),
          email: cleanOptionalString(parsed.data.email),
          phone: cleanOptionalString(parsed.data.phone),
          mobile: cleanOptionalString(parsed.data.mobile),
          role: cleanOptionalString(parsed.data.role),
          isPrimary: parsed.data.isPrimary,
          notes: cleanOptionalString(parsed.data.notes),
        },
      });
      await audit(session.userId, "corporate.counterparty_contact.updated", contactId, { counterpartyId, contactId, action: "UPDATE" }, tx);
    });

    return NextResponse.json({ contact: { id: contactId } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update contact" }, { status: 400 });
  }
}
```

The `findFirst` is scoped by `counterpartyId` as well as `contactId`, so a contact belonging to another counterparty returns 404 rather than being editable through the wrong parent.

The audit meta carries ids only — never the contact's name or email, per the `AuditEvent` rule.

- [ ] **Step 6: Run the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: all pass. Paste the output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/corporate-admin/update-schemas.ts "src/app/api/admin/corporate/counterparties/[id]/contacts/[contactId]/route.ts" tests/unit/corporate-patch-schemas.test.ts
git commit -m "Let counterparty contacts be edited and stood down"
```

---

### Task 4: Service coverage edit and deactivate

**Files:**
- Modify: `src/lib/corporate-admin/update-schemas.ts`
- Create: `src/app/api/admin/corporate/sites/[id]/coverage/[coverageId]/route.ts`
- Test: `tests/unit/corporate-patch-schemas.test.ts` (append a describe block)

**Interfaces:**
- Consumes: the `setActive` const from Task 2.
- Produces: `patchServiceCoverageSchema`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/corporate-patch-schemas.test.ts`, adding `patchServiceCoverageSchema` to the existing import:

```ts
describe("patchServiceCoverageSchema", () => {
  it("accepts a deactivation", () => {
    expect(patchServiceCoverageSchema.safeParse({ action: "SET_ACTIVE", isActive: false }).success).toBe(true);
  });

  it("accepts a field edit", () => {
    expect(patchServiceCoverageSchema.safeParse({
      action: "UPDATE",
      serviceCategory: "CLEANING",
      isPrimary: true,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-12-31",
    }).success).toBe(true);
  });

  it("rejects an effective-to before effective-from", () => {
    expect(patchServiceCoverageSchema.safeParse({
      action: "UPDATE",
      serviceCategory: "CLEANING",
      isPrimary: false,
      effectiveFrom: "2026-12-31",
      effectiveTo: "2026-01-01",
    }).success).toBe(false);
  });

  it("does not let the covering counterparty be swapped", () => {
    const parsed = patchServiceCoverageSchema.safeParse({
      action: "UPDATE",
      serviceCategory: "CLEANING",
      isPrimary: false,
      counterpartyId: "cp_other",
    });
    expect(parsed.success && "counterpartyId" in parsed.data).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/corporate-patch-schemas.test.ts`

Expected: FAIL — no export `patchServiceCoverageSchema`.

- [ ] **Step 3: Add the schema**

Append to `src/lib/corporate-admin/update-schemas.ts`:

```ts
const coverageDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Invalid date");

export const patchServiceCoverageSchema = z.discriminatedUnion("action", [
  setActive,
  z
    .object({
      action: z.literal("UPDATE"),
      serviceCategory: z.string().trim().min(1).max(120),
      roleCode: z.string().trim().max(120).optional().nullable(),
      effectiveFrom: coverageDateOnly.optional().nullable(),
      effectiveTo: coverageDateOnly.optional().nullable(),
      isPrimary: z.boolean().default(false),
      serviceLevel: z.string().trim().max(500).optional().nullable(),
      emergencyContact: z.string().trim().max(500).optional().nullable(),
      notes: z.string().trim().max(10_000).optional().nullable(),
    })
    .superRefine((value, ctx) => {
      if (value.effectiveFrom && value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
        ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "Effective-to date cannot be before effective-from date" });
      }
    }),
]);
```

`counterpartyId` is absent by design: which counterparty provides a service is the identity of the coverage row, not an editable attribute. Standing the row down and creating a new one keeps the history honest. Because the object is not `.strict()`, an extra `counterpartyId` in the body is dropped rather than rejected — which is what the fourth test asserts.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/corporate-patch-schemas.test.ts`

Expected: PASS, 13 tests total.

- [ ] **Step 5: Create the endpoint**

Create `src/app/api/admin/corporate/sites/[id]/coverage/[coverageId]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString, parseDateOnly } from "@/lib/corporate-admin/domain";
import { patchServiceCoverageSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; coverageId: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = patchServiceCoverageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid coverage update" }, { status: 400 });

  const { id: siteId, coverageId } = await context.params;
  const coverage = await db.administrativeServiceCoverage.findFirst({ where: { id: coverageId, siteId }, select: { id: true } });
  if (!coverage) return NextResponse.json({ error: "Service coverage not found" }, { status: 404 });

  try {
    await db.$transaction(async (tx) => {
      if (parsed.data.action === "SET_ACTIVE") {
        await tx.administrativeServiceCoverage.update({ where: { id: coverageId }, data: { isActive: parsed.data.isActive } });
        await audit(session.userId, "corporate.service_coverage.updated", coverageId, { siteId, coverageId, action: "SET_ACTIVE", isActive: parsed.data.isActive }, tx);
        return;
      }

      await tx.administrativeServiceCoverage.update({
        where: { id: coverageId },
        data: {
          serviceCategory: parsed.data.serviceCategory,
          roleCode: cleanOptionalString(parsed.data.roleCode),
          effectiveFrom: parsed.data.effectiveFrom ? parseDateOnly(parsed.data.effectiveFrom) : null,
          effectiveTo: parsed.data.effectiveTo ? parseDateOnly(parsed.data.effectiveTo) : null,
          isPrimary: parsed.data.isPrimary,
          serviceLevel: cleanOptionalString(parsed.data.serviceLevel),
          emergencyContact: cleanOptionalString(parsed.data.emergencyContact),
          notes: cleanOptionalString(parsed.data.notes),
        },
      });
      await audit(session.userId, "corporate.service_coverage.updated", coverageId, { siteId, coverageId, action: "UPDATE" }, tx);
    });

    return NextResponse.json({ coverage: { id: coverageId } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update service coverage" }, { status: 400 });
  }
}
```

- [ ] **Step 6: Run the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: all pass. Paste the output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/corporate-admin/update-schemas.ts "src/app/api/admin/corporate/sites/[id]/coverage/[coverageId]/route.ts" tests/unit/corporate-patch-schemas.test.ts
git commit -m "Let service coverage be edited and stood down"
```

---

### Task 5: Obligation party edit and deactivate

**Files:**
- Modify: `src/lib/corporate-admin/update-schemas.ts`
- Modify: `src/app/api/admin/corporate/obligations/[id]/parties/route.ts` (add a `PATCH` export; leave the existing `POST` untouched)
- Test: `tests/unit/corporate-patch-schemas.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `coverageDateOnly` from Task 4, and `AdministrativeObligationParty.isActive` from Task 1. It does **not** use the shared `setActive` const, because both branches need the composite-key selector.
- Produces: `patchObligationPartySchema`. Both branches carry `counterpartyId` and `roleCode` as selectors.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/corporate-patch-schemas.test.ts`, adding `patchObligationPartySchema` to the existing import:

```ts
describe("patchObligationPartySchema", () => {
  const key = { counterpartyId: "cp_1", roleCode: "LANDLORD" };

  it("accepts a deactivation carrying the composite key", () => {
    expect(patchObligationPartySchema.safeParse({ action: "SET_ACTIVE", ...key, isActive: false }).success).toBe(true);
  });

  it("rejects a deactivation with no key to identify the row", () => {
    expect(patchObligationPartySchema.safeParse({ action: "SET_ACTIVE", isActive: false }).success).toBe(false);
  });

  it("accepts an edit of the non-key fields", () => {
    expect(patchObligationPartySchema.safeParse({ action: "UPDATE", ...key, isPrimary: true }).success).toBe(true);
  });

  it("rejects an effective-to before effective-from", () => {
    expect(patchObligationPartySchema.safeParse({
      action: "UPDATE",
      ...key,
      isPrimary: false,
      effectiveFrom: "2026-06-01",
      effectiveTo: "2026-01-01",
    }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/corporate-patch-schemas.test.ts`

Expected: FAIL — no export `patchObligationPartySchema`.

- [ ] **Step 3: Add the schema**

Append to `src/lib/corporate-admin/update-schemas.ts`:

```ts
const partyKey = {
  counterpartyId: z.string().trim().min(1),
  roleCode: z.string().trim().min(1).max(120),
};

export const patchObligationPartySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SET_ACTIVE"), ...partyKey, isActive: z.boolean() }),
  z
    .object({
      action: z.literal("UPDATE"),
      ...partyKey,
      isPrimary: z.boolean().default(false),
      effectiveFrom: coverageDateOnly.optional().nullable(),
      effectiveTo: coverageDateOnly.optional().nullable(),
      notes: z.string().trim().max(10_000).optional().nullable(),
    })
    .superRefine((value, ctx) => {
      if (value.effectiveFrom && value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
        ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "Effective-to date cannot be before effective-from date" });
      }
    }),
]);
```

`counterpartyId` and `roleCode` appear as **selectors, not editable fields** — they are two thirds of the primary key. Changing either makes it a different party row, so the honest action is to stand this one down and add the correct one.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/corporate-patch-schemas.test.ts`

Expected: PASS, 17 tests total.

- [ ] **Step 5: Add PATCH to the existing parties route**

Open `src/app/api/admin/corporate/obligations/[id]/parties/route.ts`. Leave the existing `POST` and its imports untouched. Add `patchObligationPartySchema` to the imports, add `parseDateOnly` to the existing import from `@/lib/corporate-admin/domain` if it is not already there, and append this export:

```ts
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = patchObligationPartySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid party update" }, { status: 400 });

  const { id: obligationId } = await context.params;
  const key = {
    obligationId_counterpartyId_roleCode: {
      obligationId,
      counterpartyId: parsed.data.counterpartyId,
      roleCode: parsed.data.roleCode,
    },
  };

  const party = await db.administrativeObligationParty.findUnique({ where: key, select: { obligationId: true } });
  if (!party) return NextResponse.json({ error: "Obligation party not found" }, { status: 404 });

  const subject = `${obligationId}:${parsed.data.counterpartyId}:${parsed.data.roleCode}`;

  try {
    await db.$transaction(async (tx) => {
      if (parsed.data.action === "SET_ACTIVE") {
        await tx.administrativeObligationParty.update({ where: key, data: { isActive: parsed.data.isActive } });
        await audit(session.userId, "corporate.obligation_party.updated", subject, { obligationId, action: "SET_ACTIVE", isActive: parsed.data.isActive }, tx);
        return;
      }

      await tx.administrativeObligationParty.update({
        where: key,
        data: {
          isPrimary: parsed.data.isPrimary,
          effectiveFrom: parsed.data.effectiveFrom ? parseDateOnly(parsed.data.effectiveFrom) : null,
          effectiveTo: parsed.data.effectiveTo ? parseDateOnly(parsed.data.effectiveTo) : null,
          notes: cleanOptionalString(parsed.data.notes),
        },
      });
      await audit(session.userId, "corporate.obligation_party.updated", subject, { obligationId, action: "UPDATE" }, tx);
    });

    return NextResponse.json({ party: { obligationId, counterpartyId: parsed.data.counterpartyId, roleCode: parsed.data.roleCode } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update obligation party" }, { status: 400 });
  }
}
```

There is no unique-conflict branch here, unlike the site and counterparty endpoints: the only unique constraint is the primary key, and neither of its columns is editable, so an update cannot collide.

The audit subject is a composite string because these rows have no single id. It contains ids and a role code only — no name, no email.

- [ ] **Step 6: Run the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: all pass. Paste the output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/corporate-admin/update-schemas.ts "src/app/api/admin/corporate/obligations/[id]/parties/route.ts" tests/unit/corporate-patch-schemas.test.ts
git commit -m "Let obligation parties be edited and stood down"
```

---

### Task 6: Obligation-site link edit and deactivate

This is the entity that had no removal affordance at all before Task 1.

**Files:**
- Modify: `src/lib/corporate-admin/update-schemas.ts`
- Create: `src/app/api/admin/corporate/obligations/[id]/sites/[siteId]/route.ts`
- Test: `tests/unit/corporate-patch-schemas.test.ts` (append a describe block)

The link is keyed `@@id([obligationId, siteId])`, and a site id is a URL-safe cuid, so unlike the party endpoint this one addresses the row in the path.

**Interfaces:**
- Consumes: the `setActive` const from Task 2, and `AdministrativeObligationSite.isActive` from Task 1.
- Produces: `patchObligationSiteSchema`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/corporate-patch-schemas.test.ts`, adding `patchObligationSiteSchema` to the existing import:

```ts
describe("patchObligationSiteSchema", () => {
  it("accepts a deactivation, which is the only way to undo a wrong link", () => {
    expect(patchObligationSiteSchema.safeParse({ action: "SET_ACTIVE", isActive: false }).success).toBe(true);
  });

  it("accepts a scope correction", () => {
    expect(patchObligationSiteSchema.safeParse({ action: "UPDATE", scopeRole: "PRIMARY_PREMISES" }).success).toBe(true);
  });

  it("accepts an empty update, because both fields are optional", () => {
    expect(patchObligationSiteSchema.safeParse({ action: "UPDATE" }).success).toBe(true);
  });

  it("does not let the linked site be swapped", () => {
    const parsed = patchObligationSiteSchema.safeParse({ action: "UPDATE", siteId: "site_other" });
    expect(parsed.success && "siteId" in parsed.data).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/corporate-patch-schemas.test.ts`

Expected: FAIL — no export `patchObligationSiteSchema`.

- [ ] **Step 3: Add the schema**

Append to `src/lib/corporate-admin/update-schemas.ts`:

```ts
export const patchObligationSiteSchema = z.discriminatedUnion("action", [
  setActive,
  z.object({
    action: z.literal("UPDATE"),
    scopeRole: z.string().trim().max(120).optional().nullable(),
    notes: z.string().trim().max(10_000).optional().nullable(),
  }),
]);
```

`siteId` is absent: linking a different site is a different link. Stand this one down and create the correct one.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/corporate-patch-schemas.test.ts`

Expected: PASS, 21 tests total.

- [ ] **Step 5: Create the endpoint**

Create `src/app/api/admin/corporate/obligations/[id]/sites/[siteId]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { cleanOptionalString } from "@/lib/corporate-admin/domain";
import { patchObligationSiteSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; siteId: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }

  const parsed = patchObligationSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid site link update" }, { status: 400 });

  const { id: obligationId, siteId } = await context.params;
  const key = { obligationId_siteId: { obligationId, siteId } };

  const link = await db.administrativeObligationSite.findUnique({ where: key, select: { obligationId: true } });
  if (!link) return NextResponse.json({ error: "Obligation site link not found" }, { status: 404 });

  const subject = `${obligationId}:${siteId}`;

  try {
    await db.$transaction(async (tx) => {
      if (parsed.data.action === "SET_ACTIVE") {
        await tx.administrativeObligationSite.update({ where: key, data: { isActive: parsed.data.isActive } });
        await audit(session.userId, "corporate.obligation_site.updated", subject, { obligationId, siteId, action: "SET_ACTIVE", isActive: parsed.data.isActive }, tx);
        return;
      }

      await tx.administrativeObligationSite.update({
        where: key,
        data: {
          scopeRole: cleanOptionalString(parsed.data.scopeRole),
          notes: cleanOptionalString(parsed.data.notes),
        },
      });
      await audit(session.userId, "corporate.obligation_site.updated", subject, { obligationId, siteId, action: "UPDATE" }, tx);
    });

    return NextResponse.json({ link: { obligationId, siteId } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update obligation site link" }, { status: 400 });
  }
}
```

- [ ] **Step 6: Run the full gate plus a build**

Run: `pnpm lint && pnpm typecheck && pnpm test && VERCEL_ENV=preview pnpm build`

Expected: all pass, build exits 0. The build confirms all five new route files register. Paste the output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/corporate-admin/update-schemas.ts "src/app/api/admin/corporate/obligations/[id]/sites/[siteId]/route.ts" tests/unit/corporate-patch-schemas.test.ts
git commit -m "Let obligation site links be edited and stood down"
```

---

### Task 7: Record the policy

**Files:**
- Modify: `DECISIONS.md`
- Modify: `docs/ui/CA_02_SITE_RELATIONSHIP_GRAPH.md`

- [ ] **Step 1: Record the decision**

Append to `DECISIONS.md`, following the formatting of the entries already there:

```markdown
## D21 — Corporate corrects and stands down, it never deletes

Sites, counterparty contacts, service coverage, obligation parties and obligation-site
links were create-only: a mistyped address or a wrongly attached site was permanent.
Each now has a `PATCH` endpoint taking `UPDATE` to correct fields or `SET_ACTIVE` to
stand the record down.

No `DELETE` handler was added, because Corporate has never had one and an administration
record that vanishes takes its history with it. `AdministrativeObligationParty` and
`AdministrativeObligationSite` gained an `isActive` column so all five stand down the
same way; the site link previously had no removal affordance at all.

Identity fields are not editable: the counterparty on a coverage row, the counterparty and
role code on an obligation party, and the site on an obligation link. On the two link
tables this is not a policy choice but the schema — both are keyed by composite primary
keys (`@@id([obligationId, counterpartyId, roleCode])` and `@@id([obligationId, siteId])`),
so those columns cannot be updated in place. Stand the row down and create the correct one.
```

- [ ] **Step 2: Update the CA documentation**

In `docs/ui/CA_02_SITE_RELATIONSHIP_GRAPH.md`, add:

```markdown
Every Corporate record can be corrected after creation and stood down when it was
created in error. Deactivation is not deletion — the row stays visible as inactive so the
audit trail remains intact (D21). The counterparty on a coverage row or obligation party,
and the site on an obligation link, are identity and cannot be edited; stand the row down
and create the correct one instead.
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: all pass.

```bash
git add DECISIONS.md docs/ui
git commit -m "Record the correct-and-stand-down policy"
```

---

## Done when

- All five entities accept `PATCH` with `UPDATE` and `SET_ACTIVE`
- A record belonging to a different parent returns 404, not a successful edit
- No `DELETE` handler exists anywhere in `src/app/api/admin/corporate`
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass
- The migration is committed and applies via `pnpm db:deploy` on the next production deploy

## Not in this plan

The UI surfaces — `site-manager.tsx`, `counterparty-contact-manager.tsx`,
`site-coverage-manager.tsx` and `obligation-relationship-manager.tsx` — need edit and
deactivate affordances wired to these endpoints. That is a separate plan, written against
the interfaces this one produces rather than guessed ahead of them. Until it lands, the
endpoints exist but no operator can reach them.

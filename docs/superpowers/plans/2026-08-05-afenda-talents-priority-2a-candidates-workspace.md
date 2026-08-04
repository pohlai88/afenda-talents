# Afenda Talents Priority 2A — Candidates Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/admin/candidates` from a thin list into the operational registry requirements §7 describes — searchable, filterable, sortable, with a clear row-action hierarchy, a responsive card layout, and three distinct empty states.

**Architecture:** All list state (search, filters, sort, page) lives in the URL as plain `searchParams`, read by a server component — deep-linkable by construction, no client state library, no new dependency. Query building is extracted into one pure module so it is unit-testable without a database. The row becomes a small client component only because §7.5 requires row-click navigation; the candidate name stays a real `<Link>` so keyboard and middle-click still work.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, Tailwind v4, shadcn `base-nova` on Base UI, Prisma 7, vitest, Playwright.

**Prerequisite:** Priority 1 is merged. This plan assumes `PageHeader`, `StatusBadge`, `lib/status-display.ts`, and the token system exist.

## Filter coverage against §7.3 — read this before starting

Requirements §7.3 lists seven filters. This plan ships **search, status, and the four saved
shortcuts**, and defers three. That is a judgement call, stated here rather than left as a silent
gap:

| §7.3 filter | This plan | Why |
|---|---|---|
| Status | ✅ Select | |
| Invitation state | ✅ via status | `SENT` / `EXPIRED` / `REVOKED` *are* the invitation states — a separate control would filter the same column twice |
| Completion state | ✅ via status and the "In progress" / "Ready for review" shortcuts | Same column again |
| Result availability | ✅ via the "Ready for review" shortcut | `SCORED` is exactly "a result exists" |
| Inviter | ⛔ Deferred | Needs a user picker. Meaningful only once several managers invite in one round; `Candidate.invitedById` already records it and the column is displayed, so adding the filter later is a `where` clause |
| Date invited | ⛔ Deferred | A date-range control is a large amount of UI for a single bounded round; sorting by "Invited" gives the same answer by scanning |
| Date submitted | ⛔ Deferred | Same reasoning; sorting by "Submitted" covers it |

If you want the three deferred filters in this slice, say so before Task 1 — they are cheap to add
to `candidate-query.ts` but each one costs a control in the filter bar, and the bar is already the
densest part of the page.

## Global Constraints

- **Base UI, not Radix.** `render={<Link/>}` replaces `asChild`; a `Button` rendering a non-`<button>` must also pass `nativeButton={false}`.
- **No raw status code in the UI** outside the CSV export. Use `StatusBadge` / `statusDisplay`.
- **No ranking, no composite score, no ordering by anything derived from a candidate's answers.** Sorting is by name, invitation date, submission date, or last activity only. (Build-skill invariant 9, DECISIONS.md D17.)
- **No new tracked event and no new schema column.** Every column and filter reads data that already exists.
- **Destructive actions need confirmation** (`AlertDialog`), and "Delete candidate and assessment data" must say that responses and results go too (requirements §18.4, §8.8).
- **Viewers see no mutation controls at all** — remove them, do not disable them (requirements §3.2).
- **Durations are timezone-safe; wall-clock times are not.** Reuse `relativeTime` from `src/components/overview/round-summary.tsx`; dates stay `toLocaleDateString("en-GB")`.
- Copy is sentence case, uses `…` and curly quotes. Colour is never the only signal.
- Run `bash .claude/skills/afenda-talents-build/check-invariants.sh` **bare** — never piped.
- A task is done when its verification command has been **run and its output pasted**.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/candidate-query.ts` | Pure: parse `searchParams` into a validated query, and turn that query into a Prisma `where` / `orderBy`. No Prisma import — returns plain objects. |
| `tests/unit/candidate-query.test.ts` | Boundary coverage for every filter, shortcut, sort key, and the page clamp. |
| `src/components/candidates/filter-bar.tsx` | Client. Search box and filter controls that push to the URL. |
| `src/components/candidates/candidate-row.tsx` | Client. One table row: row-click navigation plus the action hierarchy. |
| `src/components/candidates/candidate-card.tsx` | The mobile card equivalent of a row. |
| `src/components/candidates/row-actions.tsx` | Client. Primary action plus overflow menu, including delete with confirmation. |
| `src/components/candidates/empty-states.tsx` | The three distinct empty states from §7.6. |
| `src/app/admin/(shell)/candidates/page.tsx` | Server. Reads params, queries, renders. |

---

### Task 1: The query module

**Files:**
- Create: `src/lib/candidate-query.ts`
- Create: `tests/unit/candidate-query.test.ts`

**Interfaces:**
- Consumes: `WORKFLOW_STAGES`, `EXCEPTION_STAGES` from `src/lib/status-display.ts`.
- Produces:
  - `SORT_KEYS: readonly ["name", "invited", "submitted", "activity"]`
  - `SHORTCUTS: readonly ["needs-follow-up", "in-progress", "ready-for-review", "closed"]`
  - `PAGE_SIZE = 25`
  - `type CandidateQuery = { search: string; status: string | null; shortcut: string | null; sort: SortKey; direction: "asc" | "desc"; page: number }`
  - `parseCandidateQuery(params: Record<string, string | undefined>): CandidateQuery`
  - `queryToWhere(query: CandidateQuery): Record<string, unknown>`
  - `activeFilterCount(query: CandidateQuery): number`

There is deliberately **no** `queryToOrderBy`. "Last activity" is derived from response rows and
candidate timestamps rather than stored in a column, so Prisma cannot order by it; sorting happens
in memory in Task 6, where all four keys can be treated the same way. One hiring round is bounded
by the 200-per-request invite cap, so this is not a scale problem.

Tasks 3 and 6 consume all of these.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/candidate-query.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  activeFilterCount,
  parseCandidateQuery,
  queryToOrderBy,
  queryToWhere,
} from "@/lib/candidate-query";

describe("parseCandidateQuery", () => {
  it("defaults to no filters, newest-invited first, page 1", () => {
    const q = parseCandidateQuery({});
    expect(q).toEqual({
      search: "",
      status: null,
      shortcut: null,
      sort: "invited",
      direction: "desc",
      page: 1,
    });
  });

  it("trims the search term", () => {
    expect(parseCandidateQuery({ q: "  amira  " }).search).toBe("amira");
  });

  it("ignores a status that is not a real one", () => {
    expect(parseCandidateQuery({ status: "DROP TABLE" }).status).toBeNull();
    expect(parseCandidateQuery({ status: "SENT" }).status).toBe("SENT");
  });

  it("ignores an unknown shortcut and an unknown sort key", () => {
    expect(parseCandidateQuery({ view: "nonsense" }).shortcut).toBeNull();
    expect(parseCandidateQuery({ sort: "score" }).sort).toBe("invited");
  });

  it("clamps the page to at least 1", () => {
    expect(parseCandidateQuery({ page: "0" }).page).toBe(1);
    expect(parseCandidateQuery({ page: "-4" }).page).toBe(1);
    expect(parseCandidateQuery({ page: "banana" }).page).toBe(1);
    expect(parseCandidateQuery({ page: "3" }).page).toBe(3);
  });
});

describe("queryToWhere", () => {
  it("is empty when nothing is filtered", () => {
    expect(queryToWhere(parseCandidateQuery({}))).toEqual({});
  });

  it("searches name and email case-insensitively", () => {
    const where = queryToWhere(parseCandidateQuery({ q: "amira" }));
    expect(where).toEqual({
      OR: [
        { fullName: { contains: "amira", mode: "insensitive" } },
        { email: { contains: "amira", mode: "insensitive" } },
      ],
    });
  });

  it("filters by an explicit status", () => {
    expect(queryToWhere(parseCandidateQuery({ status: "SCORED" }))).toEqual({ status: "SCORED" });
  });

  it("expands each shortcut into real statuses", () => {
    expect(queryToWhere(parseCandidateQuery({ view: "ready-for-review" }))).toEqual({
      status: { in: ["SCORED"] },
    });
    expect(queryToWhere(parseCandidateQuery({ view: "in-progress" }))).toEqual({
      status: { in: ["STARTED", "SUBMITTED"] },
    });
    expect(queryToWhere(parseCandidateQuery({ view: "needs-follow-up" }))).toEqual({
      status: { in: ["SENT"] },
    });
    expect(queryToWhere(parseCandidateQuery({ view: "closed" }))).toEqual({
      status: { in: ["EXPIRED", "REVOKED"] },
    });
  });

  it("lets an explicit status win over a shortcut", () => {
    const where = queryToWhere(parseCandidateQuery({ view: "closed", status: "SENT" }));
    expect(where).toEqual({ status: "SENT" });
  });

  it("combines search and status", () => {
    const where = queryToWhere(parseCandidateQuery({ q: "tan", status: "SENT" }));
    expect(where.status).toBe("SENT");
    expect(where.OR).toHaveLength(2);
  });
});

describe("activeFilterCount", () => {
  it("counts only what the person actually set", () => {
    expect(activeFilterCount(parseCandidateQuery({}))).toBe(0);
    expect(activeFilterCount(parseCandidateQuery({ q: "a" }))).toBe(1);
    expect(activeFilterCount(parseCandidateQuery({ q: "a", status: "SENT" }))).toBe(2);
    // Sort and page are not filters.
    expect(activeFilterCount(parseCandidateQuery({ sort: "name", page: "2" }))).toBe(0);
  });
});

describe("paging", () => {
  it("uses a page size the registry can actually render", () => {
    expect(PAGE_SIZE).toBeGreaterThan(0);
    expect(PAGE_SIZE).toBeLessThanOrEqual(50);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/candidate-query.test.ts`
Expected: FAIL — cannot resolve `@/lib/candidate-query`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/candidate-query.ts`:

```ts
import { EXCEPTION_STAGES, WORKFLOW_STAGES } from "@/lib/status-display";

/**
 * The registry's list state, parsed out of the URL.
 *
 * Pure: it imports no Prisma and returns plain objects, so every filter and every
 * boundary is testable without a database. Keeping state in the URL is what makes a
 * filtered view shareable and back-button-safe.
 *
 * Sorting is deliberately limited to name and three timestamps. There is no sort by
 * score, band, or anything else derived from a candidate's answers — that would be a
 * ranking, which the build spec forbids outright.
 */
export const SORT_KEYS = ["name", "invited", "submitted", "activity"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SHORTCUTS = ["needs-follow-up", "in-progress", "ready-for-review", "closed"] as const;
export type Shortcut = (typeof SHORTCUTS)[number];

export const SHORTCUT_LABEL: Record<Shortcut, string> = {
  "needs-follow-up": "Needs follow-up",
  "in-progress": "In progress",
  "ready-for-review": "Ready for review",
  closed: "Closed",
};

const SHORTCUT_STATUSES: Record<Shortcut, string[]> = {
  "needs-follow-up": ["SENT"],
  "in-progress": ["STARTED", "SUBMITTED"],
  "ready-for-review": ["SCORED"],
  closed: [...EXCEPTION_STAGES],
};

export const PAGE_SIZE = 25;

const ALL_STATUSES: string[] = [...WORKFLOW_STAGES, ...EXCEPTION_STAGES, "DRAFT"];

export type CandidateQuery = {
  search: string;
  status: string | null;
  shortcut: Shortcut | null;
  sort: SortKey;
  direction: "asc" | "desc";
  page: number;
};

export function parseCandidateQuery(
  params: Record<string, string | undefined>,
): CandidateQuery {
  const search = (params.q ?? "").trim();

  const status = params.status && ALL_STATUSES.includes(params.status) ? params.status : null;

  const shortcut =
    params.view && (SHORTCUTS as readonly string[]).includes(params.view)
      ? (params.view as Shortcut)
      : null;

  const sort =
    params.sort && (SORT_KEYS as readonly string[]).includes(params.sort)
      ? (params.sort as SortKey)
      : "invited";

  const direction = params.dir === "asc" ? "asc" : "desc";

  const parsedPage = Number.parseInt(params.page ?? "", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return { search, status, shortcut, sort, direction, page };
}

export function queryToWhere(query: CandidateQuery): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
    ];
  }

  // An explicit status is more specific than a shortcut, so it wins.
  if (query.status) {
    where.status = query.status;
  } else if (query.shortcut) {
    where.status = { in: SHORTCUT_STATUSES[query.shortcut] };
  }

  return where;
}

/** Sort and page are navigation, not filtering, so they do not count. */
export function activeFilterCount(query: CandidateQuery): number {
  return [query.search !== "", query.status !== null, query.shortcut !== null].filter(Boolean)
    .length;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/candidate-query.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/candidate-query.ts tests/unit/candidate-query.test.ts
git commit -m "feat: parse the candidate registry's list state from the URL"
```

---

### Task 2: Row actions with a clear hierarchy

**Files:**
- Create: `src/components/candidates/row-actions.tsx`
- Delete: `src/components/candidate-row-actions.tsx` (superseded)
- Modify: `src/app/admin/(shell)/candidates/page.tsx` (swap the import — full rewrite comes in Task 6)

**Interfaces:**
- Consumes: `DropdownMenu*`, `AlertDialog*`, `Button`; `DELETE /api/admin/candidate/[id]`, `POST /api/admin/invite/[id]/resend`, `POST /api/admin/invite/[id]/revoke`.
- Produces: `<CandidateRowActions id status />`. Tasks 3 and 4 render it.

Requirements §7.4: one clear primary action plus an overflow menu. Both destructive entries confirm.

- [ ] **Step 1: Write the component**

Create `src/components/candidates/row-actions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type Confirm = "revoke" | "delete";

/**
 * One primary action, everything else behind an overflow menu (requirements §7.4).
 * Both destructive entries name their object and consequence rather than saying
 * "Remove" or "Delete" on their own (§18.4).
 */
export function CandidateRowActions({
  id,
  fullName,
  status,
}: {
  id: string;
  fullName: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const canResend = status === "SENT" || status === "EXPIRED" || status === "REVOKED";
  const canRevoke = status === "SENT" || status === "STARTED";
  const isScored = status === "SCORED";

  async function post(action: "resend" | "revoke") {
    setBusy(true);
    await fetch(`/api/admin/invite/${id}/${action}`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/admin/candidate/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        render={<Link href={`/admin/candidate/${id}`} />}
      >
        {isScored ? "Review profile" : "View progress"}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`More actions for ${fullName}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {canResend && (
            <DropdownMenuItem disabled={busy} onClick={() => post("resend")}>
              Resend invitation
            </DropdownMenuItem>
          )}
          {canRevoke && (
            <DropdownMenuItem disabled={busy} onClick={() => setConfirm("revoke")}>
              Revoke this invitation
            </DropdownMenuItem>
          )}
          {(canResend || canRevoke) && <DropdownMenuSeparator />}
          <DropdownMenuItem
            disabled={busy}
            onClick={() => setConfirm("delete")}
            className="text-destructive"
          >
            Delete candidate and assessment data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "revoke"
                ? "Revoke this invitation?"
                : "Delete candidate and assessment data?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "revoke"
                ? `${fullName}'s link stops working immediately. You can issue a fresh one later with Resend.`
                : `${fullName}'s record is removed permanently, together with their answers and their profile. The audit log keeps an identity-free record that the deletion happened.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (confirm === "revoke") await post("revoke");
                else await remove();
                setConfirm(null);
              }}
            >
              {confirm === "revoke" ? "Revoke invitation" : "Delete candidate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Remove the superseded component**

```bash
git rm src/components/candidate-row-actions.tsx
```

Then update the import in `src/app/admin/(shell)/candidates/page.tsx` to
`import { CandidateRowActions } from "@/components/candidates/row-actions";` and pass the new
`fullName` prop: `<CandidateRowActions id={c.id} fullName={c.fullName} status={c.status} />`.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both silent.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: give candidate rows a primary action and an overflow menu"
```

---

### Task 3: The row and card presentations

**Files:**
- Create: `src/components/candidates/candidate-row.tsx`
- Create: `src/components/candidates/candidate-card.tsx`

**Interfaces:**
- Consumes: `StatusBadge`, `CandidateRowActions` (Task 2), `relativeTime` from `src/components/overview/round-summary.tsx`.
- Produces:
  - `type CandidateListItem = { id: string; fullName: string; email: string; status: string; sentAt: Date | null; submittedAt: Date | null; lastActivityAt: Date | null; invitedByName: string | null }`
  - `<CandidateRow item isAdmin now />` and `<CandidateCard item isAdmin now />`. Task 6 renders both.

- [ ] **Step 1: Write the row**

Create `src/components/candidates/candidate-row.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { CandidateRowActions } from "@/components/candidates/row-actions";
import { relativeTime } from "@/components/overview/round-summary";

export type CandidateListItem = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  sentAt: Date | null;
  submittedAt: Date | null;
  lastActivityAt: Date | null;
  invitedByName: string | null;
};

export function CandidateRow({
  item,
  isAdmin,
  now,
}: {
  item: CandidateListItem;
  isAdmin: boolean;
  now: Date;
}) {
  const router = useRouter();

  return (
    <TableRow
      data-candidate-id={item.id}
      className="cursor-pointer"
      onClick={(event) => {
        // Row-click is a convenience layered on top of a real link (§7.5). Clicks that
        // start inside a button, link, or menu belong to that control, not to the row.
        if ((event.target as HTMLElement).closest("a,button,[role='menu'],[role='dialog']")) return;
        router.push(`/admin/candidate/${item.id}`);
      }}
    >
      <TableCell className="font-medium">
        {/* The accessible primary: keyboard-reachable, middle-clickable, copyable. */}
        <Link href={`/admin/candidate/${item.id}`} className="underline-offset-4 hover:underline">
          {item.fullName}
        </Link>
      </TableCell>
      <TableCell className="max-w-56 truncate text-muted-foreground" title={item.email}>
        {item.email}
      </TableCell>
      <TableCell>
        <StatusBadge status={item.status} />
      </TableCell>
      <TableCell className="tabular-nums">
        {item.sentAt?.toLocaleDateString("en-GB") ?? "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {item.lastActivityAt ? relativeTime(item.lastActivityAt, now) : "—"}
      </TableCell>
      <TableCell className="tabular-nums">
        {item.submittedAt?.toLocaleDateString("en-GB") ?? "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">{item.invitedByName ?? "—"}</TableCell>
      <TableCell className="text-right">
        {isAdmin && (
          <CandidateRowActions id={item.id} fullName={item.fullName} status={item.status} />
        )}
      </TableCell>
    </TableRow>
  );
}
```

- [ ] **Step 2: Write the card**

Create `src/components/candidates/candidate-card.tsx`:

```tsx
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { CandidateRowActions } from "@/components/candidates/row-actions";
import { relativeTime } from "@/components/overview/round-summary";
import type { CandidateListItem } from "@/components/candidates/candidate-row";

/**
 * The mobile equivalent of a row (requirements §7.5, §17.1). A horizontally scrolling
 * eight-column table on a phone is not a table anyone can read, so below `md` the
 * registry renders these instead — same information, stacked, actions still labelled.
 */
export function CandidateCard({
  item,
  isAdmin,
  now,
}: {
  item: CandidateListItem;
  isAdmin: boolean;
  now: Date;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/candidate/${item.id}`}
            className="block truncate font-medium underline-offset-4 hover:underline"
          >
            {item.fullName}
          </Link>
          <p className="truncate text-sm text-muted-foreground">{item.email}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Invited</dt>
          <dd className="tabular-nums">{item.sentAt?.toLocaleDateString("en-GB") ?? "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Submitted</dt>
          <dd className="tabular-nums">{item.submittedAt?.toLocaleDateString("en-GB") ?? "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Last activity</dt>
          <dd>{item.lastActivityAt ? relativeTime(item.lastActivityAt, now) : "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Invited by</dt>
          <dd className="truncate">{item.invitedByName ?? "—"}</dd>
        </div>
      </dl>

      {isAdmin && (
        <CandidateRowActions id={item.id} fullName={item.fullName} status={item.status} />
      )}
    </li>
  );
}
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both silent.

- [ ] **Step 4: Commit**

```bash
git add src/components/candidates
git commit -m "feat: add the registry's row and mobile card presentations"
```

---

### Task 4: Search and filter bar

**Files:**
- Create: `src/components/candidates/filter-bar.tsx`

**Interfaces:**
- Consumes: `CandidateQuery`, `SHORTCUTS`, `SHORTCUT_LABEL`, `activeFilterCount` (Task 1); `WORKFLOW_STAGES`, `EXCEPTION_STAGES`, `statusDisplay`.
- Produces: `<FilterBar query resultCount />`. Task 6 renders it.

Every control writes to the URL, so a filtered view is shareable and the back button works.

- [ ] **Step 1: Write the component**

Create `src/components/candidates/filter-bar.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXCEPTION_STAGES, WORKFLOW_STAGES, statusDisplay } from "@/lib/status-display";
import {
  SHORTCUTS,
  SHORTCUT_LABEL,
  activeFilterCount,
  type CandidateQuery,
} from "@/lib/candidate-query";

const ALL = "__all__";

export function FilterBar({ query, resultCount }: { query: CandidateQuery; resultCount: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(query.search);

  // Keep the box in step when the URL changes underneath it — back button, or a
  // shortcut chip that clears the search.
  useEffect(() => setSearch(query.search), [query.search]);

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Any change to what is being shown resets paging — page 3 of the old filter is
    // meaningless under the new one.
    next.delete("page");
    router.push(`/admin/candidates?${next.toString()}`);
  }

  const active = activeFilterCount(query);
  const statuses = [...WORKFLOW_STAGES, ...EXCEPTION_STAGES];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ q: search });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="candidate-search">Search</Label>
            <Input
              id="candidate-search"
              name="candidate-search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Name or email…"
              className="w-56"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            <Search className="mr-1 size-3.5" />
            Search
          </Button>
        </form>

        <div className="space-y-2">
          <Label htmlFor="status-filter">Status</Label>
          <Select
            value={query.status ?? ALL}
            onValueChange={(value) => value && apply({ status: value === ALL ? null : value })}
          >
            <SelectTrigger id="status-filter" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any status</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusDisplay(status).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SHORTCUTS.map((shortcut) => {
          const on = query.shortcut === shortcut;
          return (
            <Button
              key={shortcut}
              size="sm"
              variant={on ? "secondary" : "ghost"}
              aria-pressed={on}
              onClick={() => apply({ view: on ? null : shortcut, status: null })}
            >
              {SHORTCUT_LABEL[shortcut]}
            </Button>
          );
        })}

        <span className="ml-auto text-sm text-muted-foreground tabular-nums" role="status">
          {resultCount} {resultCount === 1 ? "candidate" : "candidates"}
          {active > 0 && ` · ${active} filter${active === 1 ? "" : "s"} active`}
        </span>

        {active > 0 && (
          <Button size="sm" variant="ghost" onClick={() => apply({ q: null, status: null, view: null })}>
            <X className="mr-1 size-3.5" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both silent.

- [ ] **Step 3: Commit**

```bash
git add src/components/candidates/filter-bar.tsx
git commit -m "feat: add URL-backed search, status filter, and saved shortcuts"
```

---

### Task 5: The three empty states

**Files:**
- Create: `src/components/candidates/empty-states.tsx`

**Interfaces:**
- Produces: `<NoCandidates isAdmin />`, `<NoFilterMatch />`, `<NoSearchMatch term />`. Task 6 chooses between them.

Requirements §7.6 requires these to be distinguishable, each with its own recovery action.

- [ ] **Step 1: Write the component**

Create `src/components/candidates/empty-states.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

function Shell({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Nobody has been invited at all — the round has not started. */
export function NoCandidates({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Shell
      title="No candidates invited yet"
      body="Invite candidates by email. Each one receives a personal link that expires, and their profile appears here once they submit."
      action={
        isAdmin ? (
          <Button nativeButton={false} render={<Link href="/admin/invite" />}>
            Invite candidates
          </Button>
        ) : undefined
      }
    />
  );
}

/** People exist, but none match the current filters. */
export function NoFilterMatch() {
  return (
    <Shell
      title="No candidates match these filters"
      body="Nobody in this round is at that stage right now. Clear the filters to see everyone."
      action={
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/candidates" />}>
          Clear filters
        </Button>
      }
    />
  );
}

/** People exist, but the search term found nobody. */
export function NoSearchMatch({ term }: { term: string }) {
  return (
    <Shell
      title={`Nothing matches “${term}”`}
      body="Search looks at names and email addresses. Check the spelling, or try part of the address."
      action={
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/candidates" />}>
          Show all candidates
        </Button>
      }
    />
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both silent.

- [ ] **Step 3: Commit**

```bash
git add src/components/candidates/empty-states.tsx
git commit -m "feat: distinguish the registry's three empty states"
```

---

### Task 6: Wire the registry page

**Files:**
- Modify: `src/app/admin/(shell)/candidates/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: everything from Tasks 1–5.

- [ ] **Step 1: Rewrite the page**

Replace `src/app/admin/(shell)/candidates/page.tsx` entirely:

```tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import {
  PAGE_SIZE,
  parseCandidateQuery,
  queryToWhere,
  type CandidateQuery,
} from "@/lib/candidate-query";
// Note: sorting is in-memory (see sortItems below), so there is no queryToOrderBy.
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/candidates/filter-bar";
import { CandidateRow, type CandidateListItem } from "@/components/candidates/candidate-row";
import { CandidateCard } from "@/components/candidates/candidate-card";
import {
  NoCandidates,
  NoFilterMatch,
  NoSearchMatch,
} from "@/components/candidates/empty-states";

export const dynamic = "force-dynamic";

const COLUMNS = ["Candidate", "Contact", "Progress", "Invited", "Last activity", "Submitted", "Invited by"];

/** Sorting happens in memory: "last activity" is derived, not a column, and one hiring
 *  round is bounded by the 200-per-request invite cap. */
function sortItems(items: CandidateListItem[], query: CandidateQuery): CandidateListItem[] {
  const factor = query.direction === "asc" ? 1 : -1;
  const time = (d: Date | null) => d?.getTime() ?? 0;
  return [...items].sort((a, b) => {
    switch (query.sort) {
      case "name":
        return factor * a.fullName.localeCompare(b.fullName);
      case "submitted":
        return factor * (time(a.submittedAt) - time(b.submittedAt));
      case "activity":
        return factor * (time(a.lastActivityAt) - time(b.lastActivityAt));
      default:
        return factor * (time(a.sentAt) - time(b.sentAt));
    }
  });
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireHiringUser();
  const isAdmin = session.role === "ADMIN";
  const now = new Date();

  const query = parseCandidateQuery(await searchParams);

  const [matching, totalInRound, responseActivity, users] = await Promise.all([
    db.candidate.findMany({ where: queryToWhere(query), orderBy: { createdAt: "asc" } }),
    db.candidate.count(),
    db.response.groupBy({ by: ["candidateId"], _max: { updatedAt: true } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);

  const lastResponseAt = new Map(responseActivity.map((r) => [r.candidateId, r._max.updatedAt]));
  const userNames = new Map(users.map((u) => [u.id, u.name]));

  const items: CandidateListItem[] = matching.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    status: c.status,
    sentAt: c.sentAt,
    submittedAt: c.submittedAt,
    // The most recent thing that happened, whichever it was.
    lastActivityAt:
      [lastResponseAt.get(c.id) ?? null, c.submittedAt, c.openedAt, c.sentAt]
        .filter((d): d is Date => d instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
    invitedByName: c.invitedById ? (userNames.get(c.invitedById) ?? null) : null,
  }));

  const sorted = sortItems(items, query);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    if (query.search) next.set("q", query.search);
    if (query.status) next.set("status", query.status);
    if (query.shortcut) next.set("view", query.shortcut);
    if (query.sort !== "invited") next.set("sort", query.sort);
    if (query.direction !== "desc") next.set("dir", query.direction);
    if (n > 1) next.set("page", String(n));
    const qs = next.toString();
    return qs ? `/admin/candidates?${qs}` : "/admin/candidates";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="This hiring round"
        title="Candidates"
        description="Find a candidate, check where they are, and act on their invitation."
        actions={
          isAdmin ? (
            <>
              <Button variant="outline" nativeButton={false} render={<a href="/api/admin/export" />}>
                Export CSV
              </Button>
              <Button nativeButton={false} render={<Link href="/admin/invite" />}>
                Invite candidates
              </Button>
            </>
          ) : null
        }
      />

      <FilterBar query={query} resultCount={sorted.length} />

      <Card>
        <CardContent>
          {totalInRound === 0 ? (
            <NoCandidates isAdmin={isAdmin} />
          ) : sorted.length === 0 ? (
            query.search ? (
              <NoSearchMatch term={query.search} />
            ) : (
              <NoFilterMatch />
            )
          ) : (
            <>
              {/* Table on md and up; cards below, because eight columns do not fit a phone. */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      {COLUMNS.map((column) => (
                        <TableHead key={column}>{column}</TableHead>
                      ))}
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((item) => (
                      <CandidateRow key={item.id} item={item} isAdmin={isAdmin} now={now} />
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="flex flex-col gap-3 md:hidden">
                {visible.map((item) => (
                  <CandidateCard key={item.id} item={item} isAdmin={isAdmin} now={now} />
                ))}
              </ul>

              {pageCount > 1 && (
                <nav
                  aria-label="Candidate pages"
                  className="mt-4 flex items-center justify-between gap-2"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    nativeButton={false}
                    render={<Link href={pageHref(page - 1)} />}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    Page {page} of {pageCount}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= pageCount}
                    nativeButton={false}
                    render={<Link href={pageHref(page + 1)} />}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: typecheck and lint silent; all unit tests pass.

Run **bare**: `bash .claude/skills/afenda-talents-build/check-invariants.sh`
Expected: every mechanical invariant `ok`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/(shell)/candidates/page.tsx"
git commit -m "feat: wire search, filters, sorting, cards, and paging into the registry"
```

---

### Task 7: End-to-end coverage for the registry

**Files:**
- Create: `tests/e2e/08-candidates-workspace.spec.ts`

**Interfaces:**
- Consumes: `signIn` and `invite` from `tests/e2e/helpers.ts`.

- [ ] **Step 1: Write the spec**

Create `tests/e2e/08-candidates-workspace.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signIn, invite } from "./helpers";

/**
 * The registry's operational contract (requirements §7): find a candidate, narrow the
 * list, and act on a row. Every piece of list state must survive a reload, because it
 * lives in the URL.
 */
test("search, filter, and shortcut state all live in the URL", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page);
  await invite(page, `Findable-${stamp}`, `findable+${stamp}@example.com`);

  await page.goto("/admin/candidates");
  await expect(page.getByRole("row", { name: new RegExp(`findable\\+${stamp}`) })).toBeVisible();

  // Search narrows to the one candidate and survives a reload.
  await page.getByLabel("Search").fill(`findable+${stamp}`);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/[?&]q=/);
  await page.reload();
  await expect(page.getByRole("row", { name: new RegExp(`findable\\+${stamp}`) })).toBeVisible();

  // A search that matches nobody gets its own recovery state.
  await page.getByLabel("Search").fill(`nobody-${stamp}`);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText(/nothing matches/i)).toBeVisible();
  await page.getByRole("link", { name: "Show all candidates" }).click();
  await expect(page).toHaveURL(/\/admin\/candidates$/);

  // A shortcut is a pressed toggle that writes to the URL.
  const readyShortcut = page.getByRole("button", { name: "Ready for review" });
  await readyShortcut.click();
  await expect(page).toHaveURL(/[?&]view=ready-for-review/);
  await expect(readyShortcut).toHaveAttribute("aria-pressed", "true");
});

test("statuses read as sentences and never as raw codes", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page);
  await invite(page, `Worded-${stamp}`, `worded+${stamp}@example.com`);

  await page.goto("/admin/candidates");
  const row = page.getByRole("row", { name: new RegExp(`worded\\+${stamp}`) });
  await expect(row).toContainText("Invitation sent");
  await expect(row).not.toContainText("SENT");
});

test("deleting a candidate requires confirmation and removes the row", async ({ page }) => {
  const stamp = Date.now();
  await signIn(page);
  await invite(page, `Doomed-${stamp}`, `doomed+${stamp}@example.com`);

  await page.goto("/admin/candidates");
  const row = page.getByRole("row", { name: new RegExp(`doomed\\+${stamp}`) });
  await row.getByRole("button", { name: /more actions/i }).click();
  await page.getByRole("menuitem", { name: /delete candidate and assessment data/i }).click();

  // The dialog must name the consequence, not just the object.
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(/answers/i);
  await dialog.getByRole("button", { name: "Delete candidate" }).click();

  await expect(page.getByRole("row", { name: new RegExp(`doomed\\+${stamp}`) })).toHaveCount(0);
});
```

- [ ] **Step 2: Run the new spec**

Run: `pnpm dotenv -e .env.test -- playwright test tests/e2e/08-candidates-workspace.spec.ts`
Expected: 3 passed. Paste the output.

- [ ] **Step 3: Run the whole suite**

Run: `pnpm test:e2e`
Expected: all specs pass. Paste the output.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/08-candidates-workspace.spec.ts
git commit -m "test: cover registry search, filters, vocabulary, and deletion"
```

---

### Task 8: Accessibility and responsive verification

- [ ] **Step 1: Start a dev server for this session**

Use `preview_start` with the `dev` entry in `.claude/launch.json`. **Next.js refuses a second dev
server in the same directory** — if one is already running from another session, stop that one
first; `autoPort` does not help, because the guard is on the `.next` directory, not the port.

- [ ] **Step 2: Keyboard-only pass over the registry**

Tab through: search box, Search button, status select, each shortcut, then the table. Confirm the
candidate name is reachable and activates with Enter, the overflow trigger opens with Enter and
closes with Escape, and focus returns to the trigger on close.

- [ ] **Step 3: Confirm row-click does not swallow the controls**

Click a row's blank area — it navigates. Click the overflow trigger — the menu opens and the row
does **not** navigate. Click the candidate name — it navigates once, not twice.

- [ ] **Step 4: Mobile pass**

Resize to the mobile preset. Confirm the table is replaced by cards, no horizontal scrollbar
appears, actions remain labelled, and the filter controls stack rather than overflow.

- [ ] **Step 5: Full verification, every output pasted**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Run **bare**, never piped:

```bash
bash .claude/skills/afenda-talents-build/check-invariants.sh
```

```bash
pnpm test:e2e
```

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: accessibility and responsive corrections from the registry review"
```

---

## Definition of done

Every box ticked, and the outputs of `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`check-invariants.sh`, and `pnpm test:e2e` each pasted — not predicted.

Requirements §7 is satisfied: the registry supports search, filter, shortcut, sort, sticky header,
row actions with confirmation, three distinct empty states, responsive cards, a visible result and
active-filter count, and paging — with all list state deep-linkable in the URL, and no ranking or
score-derived ordering anywhere.

## Deferred to Priority 2B

Invite rework (entry-mode tabs, parsing preview with row-level validation, send confirmation and
result summary), the candidate activity timeline (§8.7), and team management refinement (§10) —
including the guided create dialog and the account-state columns.

# Afenda Talents Priority 1 — Facade Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin facade — tokens, shell, Overview, page headers, status vocabulary — so a hiring manager can see what is happening and what needs action, without adding a single new API route, mutation, schema column, or tracked event.

**Architecture:** Three pure presentation modules (`status-display.ts`, `attention.ts`, `activity.ts`) hold all the logic and are unit-tested in isolation; server components read the database and hand already-fetched rows to those pure functions. The design system moves entirely through `globals.css` CSS variables, so the installed shadcn primitives inherit it without edits. The Overview, Candidates registry, and Data page become three distinct routes inside the existing `(shell)` route group.

**Tech Stack:** Next.js 16.3 (App Router, `proxy.ts`), React 19.2, Tailwind CSS v4 (no config file — theme lives in `globals.css` via `@theme inline`), shadcn `base-nova` style on Base UI (**not Radix**), Prisma 7, Zod 4, vitest, Playwright.

## Global Constraints

- **Base UI, not Radix.** `render={<Link/>}` replaces `asChild`. A `Button` rendering a non-`<button>` element **must** also pass `nativeButton={false}` or it logs a console error.
- **Palette authority:** Executive Navy `#14324A`, Governance Teal `#2E7D7A`, Registry Blue `#1D5B79`, Ink Charcoal `#26333C`, Slate `#5C6B75`, Cool Porcelain `#F4F7F8`, White `#FFFFFF`, Border Mist `#D9E2E7`, Amber `#B7791F`, Destructive Red `#B42318`, Compass Gold `#C8A96A`.
- **Compass Gold is brand-signature only** — lockups and the diamond glyph. Never a button, status, progress, or selection colour.
- **The landing page `src/app/page.tsx` is not touched.** Its scoped `.af` palette stays exactly as-is.
- **No raw status code in the admin UI** outside the CSV export. The export's columns do not change.
- **No composite score, ranking, percentile, pass/fail, or ordering by any property of a candidate's answers.** Anywhere. (Build-skill invariant 9.)
- **No new tracked event, no new schema column, no automated reminder.** (DECISIONS.md D17.)
- **Audit rows keep storing identifiers only.** Names are resolved at read time from the live tables. (Build-skill invariant 6.)
- **Durations are timezone-safe; wall-clock times are not.** Render "3 days ago", or a day-precision `toLocaleDateString("en-GB")`. Never a clock time.
- **Colour is never the only signal.** Every status, stage, and indicator carries text.
- Copy is sentence case, uses `…` not `...`, and curly quotes.
- Run `bash .claude/skills/afenda-talents-build/check-invariants.sh` **bare** — never piped, never inside a `&&` chain. A pipe reports the pipe's exit code and a FAIL sails through.
- A task is done when its verification command has been **run and its output pasted**. Not when the code looks right.

---

### Task 1: Tokens and palette contract

**Files:**
- Modify: `src/app/globals.css:7-118` (the `@theme inline`, `:root`, and `.dark` blocks)
- Modify: `src/components/app-sidebar.tsx:44` (hard-coded gold diamond)
- Modify: `src/app/admin/login/page.tsx:49` (hard-coded gold diamond)
- Modify: `src/components/change-password-form.tsx` (hard-coded gold diamond)

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind colour utilities `bg-progress`, `text-progress`, `bg-attention`, `text-attention`, `bg-brand-gold`, plus the restyled standard tokens every shadcn primitive already consumes. Task 3 depends on `progress` and `attention` existing as Tailwind colours.

- [ ] **Step 1: Add the three new colour mappings to `@theme inline`**

Insert immediately after the `--color-background` / `--color-foreground` lines (currently `src/app/globals.css:8-9`):

```css
  --color-progress: var(--progress);
  --color-progress-foreground: var(--progress-foreground);
  --color-attention: var(--attention);
  --color-attention-foreground: var(--attention-foreground);
  --color-brand-gold: var(--brand-gold);
```

- [ ] **Step 2: Replace the whole `:root` block**

Replace `src/app/globals.css:51-84` entirely:

```css
:root {
  /* Operational design system — DECISIONS.md D17. Hex, not oklch: the requirements
     document specifies exact hex and a round-trip would introduce drift. */
  --background: #f4f7f8;
  --foreground: #26333c;
  --card: #ffffff;
  --card-foreground: #26333c;
  --popover: #ffffff;
  --popover-foreground: #26333c;
  --primary: #14324a;
  --primary-foreground: #ffffff;
  --secondary: #e8eef0;
  --secondary-foreground: #14324a;
  --muted: #e8eef0;
  --muted-foreground: #5c6b75;
  --accent: #dce7e6;
  --accent-foreground: #14324a;
  --destructive: #b42318;
  --border: #d9e2e7;
  --input: #d9e2e7;
  --ring: #1d5b79;

  /* Governance Teal. Operational progress and the "ready for review" tone.
     Never candidate quality — see the build-skill's ninth invariant. */
  --progress: #2e7d7a;
  --progress-foreground: #ffffff;
  /* Amber. Needs human review or follow-up. Never red, never green. */
  --attention: #b7791f;
  --attention-foreground: #ffffff;
  /* Compass Gold. Brand lockups only. */
  --brand-gold: #c8a96a;

  /* A neutral ramp. Deliberately NOT repurposed as per-dimension colours:
     colour must never encode a band or a score. */
  --chart-1: #8ea3ae;
  --chart-2: #7b929e;
  --chart-3: #68818e;
  --chart-4: #55707e;
  --chart-5: #425f6e;

  --radius: 0.625rem;

  /* White sidebar with a navy active row. A fully navy sidebar reads as banking
     software, which the requirements explicitly warn against. */
  --sidebar: #ffffff;
  --sidebar-foreground: #26333c;
  --sidebar-primary: #14324a;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #e8eef0;
  --sidebar-accent-foreground: #14324a;
  --sidebar-border: #d9e2e7;
  --sidebar-ring: #1d5b79;
}
```

- [ ] **Step 3: Replace the whole `.dark` block**

Replace `src/app/globals.css:86-118` entirely. Dark mode remains unreachable — nothing adds the `.dark` class and this slice adds no theme toggle — but it is kept consistent so it is not left contradicting the new system:

```css
/* Unreachable today: nothing adds this class and there is no theme toggle.
   Kept in step with :root so it is not left contradicting the new system. */
.dark {
  --background: #0f1d28;
  --foreground: #edf2f4;
  --card: #162835;
  --card-foreground: #edf2f4;
  --popover: #162835;
  --popover-foreground: #edf2f4;
  --primary: #7fb2ce;
  --primary-foreground: #0f1d28;
  --secondary: #1e3646;
  --secondary-foreground: #edf2f4;
  --muted: #1e3646;
  --muted-foreground: #9db0bc;
  --accent: #22404f;
  --accent-foreground: #edf2f4;
  --destructive: #e5675a;
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: #7fb2ce;
  --progress: #4fa5a1;
  --progress-foreground: #0f1d28;
  --attention: #d9a441;
  --attention-foreground: #0f1d28;
  --brand-gold: #c8a96a;
  --chart-1: #52707f;
  --chart-2: #5f7f8e;
  --chart-3: #6c8e9d;
  --chart-4: #799dac;
  --chart-5: #86acbb;
  --sidebar: #162835;
  --sidebar-foreground: #edf2f4;
  --sidebar-primary: #7fb2ce;
  --sidebar-primary-foreground: #0f1d28;
  --sidebar-accent: #1e3646;
  --sidebar-accent-foreground: #edf2f4;
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: #7fb2ce;
}
```

- [ ] **Step 4: Retire the three hard-coded gold hexes**

In `src/components/app-sidebar.tsx`, `src/app/admin/login/page.tsx`, and `src/components/change-password-form.tsx`, replace every occurrence of `bg-[#C8A96A]` with `bg-brand-gold`. There is exactly one per file. Verify none remain:

Run: `grep -rn "C8A96A" src/ --include=*.tsx`
Expected: only `src/app/page.tsx` (the landing poster's scoped `.af` palette, which is deliberately untouched).

- [ ] **Step 5: Verify the build compiles the new theme**

Run: `pnpm typecheck && pnpm lint`
Expected: both silent.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/components/app-sidebar.tsx src/app/admin/login/page.tsx src/components/change-password-form.tsx
git commit -m "feat: adopt the operational palette as the token system (D17)"
```

---

### Task 2: Status vocabulary module

**Files:**
- Create: `src/lib/status-display.ts`
- Create: `tests/unit/status-display.test.ts`

**Interfaces:**
- Consumes: `STATUSES` and `Status` from `src/lib/status.ts`.
- Produces:
  - `type StatusTone = "neutral" | "info" | "progress" | "ready" | "exception"`
  - `type StatusDisplay = { label: string; tone: StatusTone }`
  - `statusDisplay(status: string): StatusDisplay`
  - `WORKFLOW_STAGES: readonly Status[]` — `["SENT", "STARTED", "SUBMITTED", "SCORED"]`
  - `EXCEPTION_STAGES: readonly Status[]` — `["EXPIRED", "REVOKED"]`
  - `STAGE_EXPLANATION: Record<string, string>`

Tasks 3, 6, and 9 all consume these.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/status-display.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { STATUSES } from "@/lib/status";
import {
  EXCEPTION_STAGES,
  STAGE_EXPLANATION,
  WORKFLOW_STAGES,
  statusDisplay,
} from "@/lib/status-display";

describe("statusDisplay", () => {
  it("gives every canonical status a readable label", () => {
    for (const status of STATUSES) {
      const { label } = statusDisplay(status);
      expect(label.length).toBeGreaterThan(0);
      // The whole point of this module: no raw code reaches the UI.
      expect(label).not.toBe(status);
      expect(label).not.toMatch(/^[A-Z_]+$/);
    }
  });

  it("does not call SUBMITTED 'Completed' — the profile is not available yet", () => {
    expect(statusDisplay("SUBMITTED").label).toBe("Processing results");
    expect(statusDisplay("SCORED").label).toBe("Ready for review");
  });

  it("uses the agreed label for each status", () => {
    expect(statusDisplay("DRAFT").label).toBe("Invitation prepared");
    expect(statusDisplay("SENT").label).toBe("Invitation sent");
    expect(statusDisplay("STARTED").label).toBe("Assessment started");
    expect(statusDisplay("EXPIRED").label).toBe("Invitation expired");
    expect(statusDisplay("REVOKED").label).toBe("Invitation revoked");
  });

  it("marks exceptions with the exception tone and never a destructive one", () => {
    expect(statusDisplay("EXPIRED").tone).toBe("exception");
    expect(statusDisplay("REVOKED").tone).toBe("exception");
  });

  it("falls back safely for an unrecognised status", () => {
    expect(statusDisplay("WAT")).toEqual({ label: "WAT", tone: "neutral" });
  });
});

describe("workflow stages", () => {
  it("is a current-state distribution, not a funnel: stages are mutually exclusive", () => {
    expect(WORKFLOW_STAGES).toEqual(["SENT", "STARTED", "SUBMITTED", "SCORED"]);
    expect(new Set(WORKFLOW_STAGES).size).toBe(WORKFLOW_STAGES.length);
  });

  it("keeps exceptions out of the progress stages", () => {
    expect(EXCEPTION_STAGES).toEqual(["EXPIRED", "REVOKED"]);
    for (const stage of EXCEPTION_STAGES) {
      expect(WORKFLOW_STAGES).not.toContain(stage);
    }
  });

  it("explains every stage it renders", () => {
    for (const stage of WORKFLOW_STAGES) {
      expect(STAGE_EXPLANATION[stage].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/status-display.test.ts`
Expected: FAIL — cannot resolve `@/lib/status-display`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/status-display.ts`:

```ts
import type { Status } from "@/lib/status";

/**
 * Canonical status codes are for the database, the CSV export, and audit rows.
 * They are not for hiring managers. This module is the single place a code becomes
 * a sentence — see the requirements document §18.2 and DECISIONS.md D17.
 *
 * Pure: no Prisma, no I/O, no React. Unit-tested in tests/unit/status-display.test.ts.
 */
export type StatusTone = "neutral" | "info" | "progress" | "ready" | "exception";

export type StatusDisplay = { label: string; tone: StatusTone };

const DISPLAY: Record<Status, StatusDisplay> = {
  DRAFT: { label: "Invitation prepared", tone: "neutral" },
  SENT: { label: "Invitation sent", tone: "info" },
  STARTED: { label: "Assessment started", tone: "progress" },
  // Deliberately not "Completed". Scoring is synchronous today, but SUBMITTED is a
  // real intermediate state, and "Completed" would promise a profile that may not exist.
  SUBMITTED: { label: "Processing results", tone: "progress" },
  SCORED: { label: "Ready for review", tone: "ready" },
  // An expired or revoked invitation is an administrative fact, not an error, so the
  // exception tone is a muted outline — never destructive red.
  EXPIRED: { label: "Invitation expired", tone: "exception" },
  REVOKED: { label: "Invitation revoked", tone: "exception" },
};

export function statusDisplay(status: string): StatusDisplay {
  return DISPLAY[status as Status] ?? { label: status, tone: "neutral" };
}

/**
 * The overview strip is a current-state distribution: each candidate is counted once,
 * under the stage matching their present status. It is not a conversion funnel — the
 * system stores no stage-transition history, so "ever reached stage" is unknowable.
 *
 * DRAFT is absent on purpose: the invite handler moves a candidate to SENT in the same
 * request, so a persisted DRAFT row is a failure, not a stage.
 */
export const WORKFLOW_STAGES = ["SENT", "STARTED", "SUBMITTED", "SCORED"] as const;

export const EXCEPTION_STAGES = ["EXPIRED", "REVOKED"] as const;

export const STAGE_EXPLANATION: Record<string, string> = {
  SENT: "Personal link sent, not opened yet",
  STARTED: "Opened the link and began answering",
  SUBMITTED: "Answers received, profile being prepared",
  SCORED: "Profile ready for a hiring reviewer",
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/status-display.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/status-display.ts tests/unit/status-display.test.ts
git commit -m "feat: map canonical statuses to readable labels and tones"
```

---

### Task 3: StatusBadge

**Files:**
- Create: `src/components/status-badge.tsx`

**Interfaces:**
- Consumes: `statusDisplay`, `StatusTone` from Task 2; the `progress` and `attention` Tailwind colours from Task 1; `Badge` from `src/components/ui/badge.tsx`.
- Produces: `<StatusBadge status={string} className?={string} />`. Tasks 6 and 9 render it.

- [ ] **Step 1: Write the component**

Create `src/components/status-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusDisplay, type StatusTone } from "@/lib/status-display";

/**
 * The label is real text, never colour alone — WCAG 2.2 AA and requirements §16.
 * "ready" is Governance Teal because it is operational progress: a profile is waiting
 * for a reviewer. It is never a judgement about the candidate.
 */
const TONE: Record<StatusTone, string> = {
  neutral: "border-border bg-transparent text-muted-foreground",
  info: "border-transparent bg-secondary text-secondary-foreground",
  progress: "border-transparent bg-progress/12 text-progress",
  ready: "border-transparent bg-progress text-progress-foreground",
  // Distinguished by border style rather than another colour, so exceptions read as
  // administrative facts and the palette keeps red for genuinely destructive things.
  exception: "border-dashed border-border bg-transparent text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { label, tone } = statusDisplay(status);
  return (
    <Badge variant="outline" className={cn(TONE[tone], className)}>
      {label}
    </Badge>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: silent.

- [ ] **Step 3: Commit**

```bash
git add src/components/status-badge.tsx
git commit -m "feat: add StatusBadge with token-driven tones"
```

---

### Task 4: Shell and account menu

**Files:**
- Modify: `src/components/app-sidebar.tsx` (full rewrite of the component body)
- Modify: `src/app/admin/(shell)/layout.tsx:37-38` (header label only)

**Interfaces:**
- Consumes: `Sidebar*` from `src/components/ui/sidebar.tsx`, `DropdownMenu*` from `src/components/ui/dropdown-menu.tsx`, `Badge`, `Button`.
- Produces: the five-item role-aware navigation. Tasks 6, 7, and 9 rely on `/admin`, `/admin/candidates`, `/admin/invite`, `/admin/users`, and `/admin/data` being the nav targets.

- [ ] **Step 1: Rewrite `src/components/app-sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronsUpDown,
  Database,
  KeyRound,
  LayoutDashboard,
  LogOut,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

type ShellUser = { name: string; email: string; role: string };

export function AppSidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user.role === "ADMIN";

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  // Operational destinations only. Account utilities live in the footer menu —
  // requirements §4.2. Export is a page action, not a destination, so it is not here.
  const items = [
    { title: "Overview", href: "/admin", icon: LayoutDashboard, show: true },
    { title: "Candidates", href: "/admin/candidates", icon: UsersRound, show: true },
    { title: "Invite", href: "/admin/invite", icon: UserPlus, show: isAdmin },
    { title: "Team", href: "/admin/users", icon: Users, show: isAdmin },
    { title: "Data & audit", href: "/admin/data", icon: Database, show: isAdmin },
  ];

  return (
    // offcanvas, not icon: requirements §5.1 bans icon-only navigation. Desktop keeps
    // 256px with permanent text labels; mobile gets the drawer.
    // print:hidden — the candidate profile prints, and the global print CSS only hides <nav>.
    <Sidebar collapsible="offcanvas" className="print:hidden">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rotate-45 bg-brand-gold" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Afenda Talents</span>
            <span className="block truncate text-xs text-muted-foreground">
              Hiring assessment workspace
            </span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>This hiring round</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((item) => item.show)
                .map((item) => {
                  const active = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        // Three signals, as requirements §5.1 demands: background and
                        // weight come from the primitive's data-active styles, the left
                        // indicator is added here.
                        className="relative data-active:before:absolute data-active:before:inset-y-1 data-active:before:left-0 data-active:before:w-0.5 data-active:before:rounded-full data-active:before:bg-primary"
                        render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    aria-label={`Account menu for ${user.name}`}
                    className="data-open:bg-sidebar-accent"
                  />
                }
              >
                <div className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
                <Badge variant={isAdmin ? "default" : "secondary"}>
                  {isAdmin ? "Admin" : "Viewer"}
                </Badge>
                <ChevronsUpDown className="ml-1 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem
                  render={<Link href="/admin/change-password" />}
                  nativeButton={false}
                >
                  <KeyRound />
                  Change password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 2: Update the shell header label**

In `src/app/admin/(shell)/layout.tsx`, replace lines 37-38:

```tsx
          <span className="text-sm font-medium">Afenda Talents</span>
          <span className="text-sm text-muted-foreground">· one hiring round</span>
```

with:

```tsx
          <span className="text-sm text-muted-foreground">One hiring round</span>
```

The brand name now lives in the sidebar header, so repeating it here is the duplication requirements §2.3 asks to remove.

- [ ] **Step 3: Verify no icon-collapse classes survive**

Run: `grep -n "collapsible=icon" src/components/app-sidebar.tsx`
Expected: no output. (`collapsible="offcanvas"` makes every `group-data-[collapsible=icon]:*` class dead.)

- [ ] **Step 4: Verify it compiles and lints**

Run: `pnpm typecheck && pnpm lint`
Expected: both silent.

If `DropdownMenuItem` rejects `nativeButton`, drop that prop and instead wrap the link: `<DropdownMenuItem render={<Link href="/admin/change-password" />}>`. Base UI's menu item renders a `div` with `role="menuitem"` by default, so the native-button warning applies only where the primitive opts into button semantics.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-sidebar.tsx "src/app/admin/(shell)/layout.tsx"
git commit -m "feat: role-aware offcanvas shell with an account menu"
```

---

### Task 5: PageHeader

**Files:**
- Create: `src/components/page-header.tsx`

**Interfaces:**
- Produces: `<PageHeader eyebrow? title description? meta? actions? />` where `meta` and `actions` are `ReactNode`. Tasks 6, 7, and 9 render it, as does the follow-up pass over `/admin/invite` and `/admin/users` in Task 6 Step 4.

- [ ] **Step 1: Write the component**

Create `src/components/page-header.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The title hierarchy every admin page uses: eyebrow, title, one-sentence purpose,
 * optional metadata, actions on the right (requirements §4.3).
 *
 * Props plus ReactNode slots rather than a compound component with context: there are
 * five consumers, each rendering a title and at most two buttons.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold text-balance">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>
        )}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: silent.

- [ ] **Step 3: Commit**

```bash
git add src/components/page-header.tsx
git commit -m "feat: add the shared PageHeader"
```

---

### Task 6: Extract `/admin/candidates`

**Files:**
- Create: `src/app/admin/(shell)/candidates/page.tsx`
- Modify: `src/app/admin/(shell)/invite/page.tsx` (adopt PageHeader)
- Modify: `src/app/admin/(shell)/users/page.tsx` (adopt PageHeader)

**Interfaces:**
- Consumes: `PageHeader` (Task 5), `StatusBadge` (Task 3), `WORKFLOW_STAGES` and `statusDisplay` (Task 2).
- Produces: the route `/admin/candidates`, honouring `?status=<CODE>`. Task 9's workflow strip links here. Task 11's e2e updates target it.

The table body is moved verbatim from today's dashboard. Search, sorting, advanced filtering, responsive cards, and pagination are **Priority 2 and out of scope** — do not add them.

- [ ] **Step 1: Create the page**

Create `src/app/admin/(shell)/candidates/page.tsx`:

```tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import { statusDisplay } from "@/lib/status-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { CandidateRowActions } from "@/components/candidate-row-actions";

export const dynamic = "force-dynamic";

/**
 * The operational registry. Priority 1 ships it thin: the overview's workflow strip
 * links here with ?status=, and that is the only filtering. Search, sorting, saved
 * views and responsive cards are Priority 2.
 */
export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireHiringUser();
  const isAdmin = session.role === "ADMIN";
  const { status } = await searchParams;

  const candidates = await db.candidate.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "asc" },
  });

  const filterLabel = status ? statusDisplay(status).label : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="This hiring round"
        title="Candidates"
        description="Find a candidate, check where they are, and act on their invitation."
        meta={
          filterLabel ? (
            <>
              <span className="text-muted-foreground">
                Showing {candidates.length} with status “{filterLabel}”
              </span>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/candidates" />}>
                Clear filter
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground tabular-nums">
              {candidates.length} in this round
            </span>
          )
        }
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

      <Card>
        <CardContent>
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-sm font-medium">
                {filterLabel ? "No candidates at this stage" : "No candidates invited yet"}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {filterLabel
                  ? "Nobody in this round currently has that status."
                  : "Invite candidates by email. Each receives a personal one-time link."}
              </p>
              {filterLabel ? (
                <Button className="mt-2" variant="outline" nativeButton={false} render={<Link href="/admin/candidates" />}>
                  Show all candidates
                </Button>
              ) : (
                isAdmin && (
                  <Button className="mt-2" nativeButton={false} render={<Link href="/admin/invite" />}>
                    Invite candidates
                  </Button>
                )
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.id} data-candidate-id={c.id}>
                    <TableCell className="font-medium">
                      {c.status === "SCORED" ? (
                        <Link className="underline underline-offset-4" href={`/admin/candidate/${c.id}`}>
                          {c.fullName}
                        </Link>
                      ) : (
                        c.fullName
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground" title={c.email}>
                      {c.email}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {c.sentAt?.toLocaleDateString("en-GB") ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {c.submittedAt?.toLocaleDateString("en-GB") ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && <CandidateRowActions id={c.id} status={c.status} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Give `/admin/invite` a PageHeader**

In `src/app/admin/(shell)/invite/page.tsx`, wrap the existing `<InviteForm …/>` so the page reads:

```tsx
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <PageHeader
        eyebrow="This hiring round"
        title="Invite candidates"
        description="Each candidate receives a personal one-time link that expires. There are no candidate accounts — the link is the credential."
      />
      <InviteForm
        invitationPreviewHtml={invitationHtml(
          "Jane Candidate",
          "#personal-one-time-link",
          sampleExpiry,
        )}
        receiptPreviewHtml={receiptHtml("Jane Candidate")}
      />
    </div>
  );
```

The `sampleExpiry` line and its `eslint-disable-next-line react-hooks/purity` comment stay exactly as they are — the expiry is request-time by design and the page is `force-dynamic`.

Add `import { PageHeader } from "@/components/page-header";`. Then remove the now-duplicated `<CardHeader>` block (title and description) from `src/components/invite-form.tsx`, keeping `<CardContent>` and `<CardFooter>` — the heading moved up to the page.

- [ ] **Step 3: Give `/admin/users` a PageHeader**

In `src/app/admin/(shell)/users/page.tsx`, replace the `<h1>` and `<p>` pair with:

```tsx
      <PageHeader
        eyebrow="Workspace"
        title="Hiring team"
        description="Admins invite, revoke, export and manage this list. Viewers can open the dashboard and candidate profiles, and change nothing."
      />
```

Add the import.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both silent.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(shell)/candidates/page.tsx" "src/app/admin/(shell)/invite/page.tsx" "src/app/admin/(shell)/users/page.tsx" src/components/invite-form.tsx
git commit -m "feat: extract the candidates registry and adopt PageHeader"
```

---

### Task 7: Extract `/admin/data`

**Files:**
- Create: `src/app/admin/(shell)/data/page.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 5), the existing `DangerZone` component, `requireAdmin`, `env.RETENTION_DAYS`.
- Produces: the route `/admin/data`. Task 9 must **not** render `DangerZone`. Task 11's purge e2e targets this route.

Audit exploration is **Priority 5 and out of scope**.

- [ ] **Step 1: Create the page**

Create `src/app/admin/(shell)/data/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-admin";
import { env } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DangerZone } from "@/components/danger-zone";

export const dynamic = "force-dynamic";

/**
 * Retention and deletion, kept away from the daily workflow: requirements §11.1 forbids
 * purge controls on the candidate dashboard. Audit exploration lands here in Priority 5.
 */
export default async function DataPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <PageHeader
        eyebrow="Workspace"
        title="Data & audit"
        description="What Afenda Talents keeps, for how long, and how to delete it."
      />

      <Card>
        <CardHeader>
          <CardTitle>Retention</CardTitle>
          <CardDescription>
            Candidates are told their responses are kept for {env.RETENTION_DAYS} days from
            submission.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Deletion is a manual step. Nothing expires on its own, so honouring the retention
            promise means coming here and running it.
          </p>
          <p className="text-muted-foreground">
            Deleting removes names, emails, answers and results. The audit log keeps a record
            that the deletion happened — identifiers and timestamps only, never a name or an
            email — so the retention promise stays provable after the data is gone.
          </p>
        </CardContent>
      </Card>

      <DangerZone retentionDays={env.RETENTION_DAYS} />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both silent.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/(shell)/data/page.tsx"
git commit -m "feat: move retention and purge onto a dedicated data page"
```

---

### Task 8: Attention rules and activity sentences

**Files:**
- Create: `src/lib/attention.ts`
- Create: `src/lib/activity.ts`
- Create: `tests/unit/attention.test.ts`
- Create: `tests/unit/activity.test.ts`

**Interfaces:**
- Consumes: nothing but its own arguments — both modules are pure, take already-fetched rows, and import no Prisma. (Same discipline as `lib/scoring.ts`.)
- Produces:
  - `UNOPENED_AFTER_HOURS`, `STALLED_AFTER_HOURS`, `EXPIRING_WITHIN_HOURS` — all `72`
  - `type CandidateFacts`, `type AttentionItem`, `type WorkspaceAttentionItem`
  - `hiringAttention(facts: CandidateFacts[], now: Date): AttentionItem[]`
  - `workspaceAttention(users: { id: string; name: string; mustChangePassword: boolean }[]): WorkspaceAttentionItem[]`
  - `FEED_ACTIONS: readonly string[]`
  - `activitySentence(input: { action: string; actorName: string | null; subjectName: string | null }): string | null`

Task 9 consumes all of these.

- [ ] **Step 1: Write the failing attention test**

Create `tests/unit/attention.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  EXPIRING_WITHIN_HOURS,
  STALLED_AFTER_HOURS,
  UNOPENED_AFTER_HOURS,
  hiringAttention,
  workspaceAttention,
  type CandidateFacts,
} from "@/lib/attention";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

const base: CandidateFacts = {
  id: "c1",
  fullName: "Amira Yusof",
  status: "SENT",
  sentAt: hoursAgo(1),
  openedAt: null,
  startedAt: null,
  expiresAt: hoursAhead(24 * 14),
  lastResponseAt: null,
  computedAt: null,
  lastViewedAt: null,
};

const kinds = (facts: CandidateFacts[]) => hiringAttention(facts, NOW).map((i) => i.kind);

describe("invitation not opened", () => {
  it("flags a SENT invitation unopened for longer than the threshold", () => {
    expect(kinds([{ ...base, sentAt: hoursAgo(UNOPENED_AFTER_HOURS + 1) }])).toContain("unopened");
  });

  it("does not flag one that is exactly at the threshold", () => {
    expect(kinds([{ ...base, sentAt: hoursAgo(UNOPENED_AFTER_HOURS) }])).not.toContain("unopened");
  });

  it("does not flag one that has been opened", () => {
    const opened = { ...base, sentAt: hoursAgo(200), openedAt: hoursAgo(100) };
    expect(kinds([opened])).not.toContain("unopened");
  });
});

describe("assessment in progress", () => {
  it("measures staleness from the last saved answer, not from startedAt", () => {
    const stale = {
      ...base,
      status: "STARTED",
      startedAt: hoursAgo(500),
      lastResponseAt: hoursAgo(1),
    };
    // Started long ago but answering a minute ago — that is progress, not a stall.
    expect(kinds([stale])).not.toContain("stalled");
  });

  it("flags a candidate whose last answer is older than the threshold", () => {
    const stalled = {
      ...base,
      status: "STARTED",
      startedAt: hoursAgo(500),
      lastResponseAt: hoursAgo(STALLED_AFTER_HOURS + 1),
    };
    expect(kinds([stalled])).toContain("stalled");
  });

  it("falls back to startedAt when no answer has been saved yet", () => {
    const noAnswers = {
      ...base,
      status: "STARTED",
      startedAt: hoursAgo(STALLED_AFTER_HOURS + 1),
      lastResponseAt: null,
    };
    expect(kinds([noAnswers])).toContain("stalled");
  });
});

describe("expiring soon", () => {
  it("flags a SENT invitation expiring inside the window", () => {
    expect(kinds([{ ...base, expiresAt: hoursAhead(EXPIRING_WITHIN_HOURS - 1) }])).toContain("expiring");
  });

  it("flags a STARTED invitation expiring inside the window", () => {
    const started = { ...base, status: "STARTED", expiresAt: hoursAhead(1) };
    expect(kinds([started])).toContain("expiring");
  });

  it("does not flag one that already expired", () => {
    const past = { ...base, expiresAt: hoursAgo(1) };
    expect(kinds([past])).not.toContain("expiring");
  });

  it("does not flag a submitted candidate", () => {
    const submitted = { ...base, status: "SUBMITTED", expiresAt: hoursAhead(1) };
    expect(kinds([submitted])).not.toContain("expiring");
  });
});

describe("profile awaiting first review", () => {
  it("flags a scored profile nobody has opened", () => {
    const scored = { ...base, status: "SCORED", computedAt: hoursAgo(10), lastViewedAt: null };
    expect(kinds([scored])).toContain("awaiting-review");
  });

  it("clears once viewed after the result was computed", () => {
    const viewed = { ...base, status: "SCORED", computedAt: hoursAgo(10), lastViewedAt: hoursAgo(2) };
    expect(kinds([viewed])).not.toContain("awaiting-review");
  });

  it("still flags when the only view predates the result", () => {
    const rescored = { ...base, status: "SCORED", computedAt: hoursAgo(2), lastViewedAt: hoursAgo(10) };
    expect(kinds([rescored])).toContain("awaiting-review");
  });
});

describe("ordering", () => {
  it("puts time-critical items first and never orders by anything about the answers", () => {
    const items = hiringAttention(
      [
        { ...base, id: "a", status: "SCORED", computedAt: hoursAgo(10), lastViewedAt: null },
        { ...base, id: "b", expiresAt: hoursAhead(2) },
      ],
      NOW,
    );
    expect(items[0].kind).toBe("expiring");
  });
});

describe("workspaceAttention", () => {
  it("returns only users still on an issued password", () => {
    const items = workspaceAttention([
      { id: "u1", name: "Ada", mustChangePassword: true },
      { id: "u2", name: "Grace", mustChangePassword: false },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Ada");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/attention.test.ts`
Expected: FAIL — cannot resolve `@/lib/attention`.

- [ ] **Step 3: Write `src/lib/attention.ts`**

```ts
/**
 * Attention rules — product policy, written down.
 *
 * Pure by design: it imports no Prisma and performs no I/O, so every threshold is
 * testable at its boundary. The overview fetches rows and hands them here.
 *
 * Nothing here sends anything. "Resend invitation" stays an explicit administrator
 * action (build spec §12 forbids scheduled reminders, and DECISIONS.md D17 does not
 * relax that).
 */
export const UNOPENED_AFTER_HOURS = 72;
export const STALLED_AFTER_HOURS = 72;
export const EXPIRING_WITHIN_HOURS = 72;

export type AttentionKind = "expiring" | "unopened" | "stalled" | "awaiting-review";

export type CandidateFacts = {
  id: string;
  fullName: string;
  status: string;
  sentAt: Date | null;
  openedAt: Date | null;
  startedAt: Date | null;
  expiresAt: Date | null;
  /** max(Response.updatedAt) for this candidate, or null when nothing is saved yet. */
  lastResponseAt: Date | null;
  /** Result.computedAt, or null when unscored. */
  computedAt: Date | null;
  /** Newest result.viewed audit event for this candidate, or null. */
  lastViewedAt: Date | null;
};

export type AttentionItem = {
  kind: AttentionKind;
  candidateId: string;
  fullName: string;
  reason: string;
  /** The moment the row's age is measured from. */
  since: Date;
};

export type WorkspaceAttentionItem = { userId: string; name: string; reason: string };

const HOUR = 3_600_000;

/** Time-critical first. Within a kind, the oldest — most overdue — leads. */
const KIND_ORDER: AttentionKind[] = ["expiring", "unopened", "stalled", "awaiting-review"];

export function hiringAttention(facts: CandidateFacts[], now: Date): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const c of facts) {
    if (c.status === "SENT" && !c.openedAt && c.sentAt && now.getTime() - c.sentAt.getTime() > UNOPENED_AFTER_HOURS * HOUR) {
      items.push({
        kind: "unopened",
        candidateId: c.id,
        fullName: c.fullName,
        reason: "Invitation sent but never opened",
        since: c.sentAt,
      });
    }

    if (c.status === "STARTED") {
      // Staleness is measured from the last saved answer. startedAt alone would flag
      // anyone who opened the link days ago and is answering right now.
      const lastActivity = c.lastResponseAt ?? c.startedAt;
      if (lastActivity && now.getTime() - lastActivity.getTime() > STALLED_AFTER_HOURS * HOUR) {
        items.push({
          kind: "stalled",
          candidateId: c.id,
          fullName: c.fullName,
          reason: "Started the assessment, nothing saved since",
          since: lastActivity,
        });
      }
    }

    if ((c.status === "SENT" || c.status === "STARTED") && c.expiresAt) {
      const remaining = c.expiresAt.getTime() - now.getTime();
      if (remaining > 0 && remaining < EXPIRING_WITHIN_HOURS * HOUR) {
        items.push({
          kind: "expiring",
          candidateId: c.id,
          fullName: c.fullName,
          reason: "Invitation expires soon",
          since: c.expiresAt,
        });
      }
    }

    if (c.status === "SCORED" && c.computedAt) {
      const reviewed = c.lastViewedAt !== null && c.lastViewedAt.getTime() > c.computedAt.getTime();
      if (!reviewed) {
        items.push({
          kind: "awaiting-review",
          candidateId: c.id,
          fullName: c.fullName,
          reason: "Profile ready, not opened by anyone yet",
          since: c.computedAt,
        });
      }
    }
  }

  return items.sort((a, b) => {
    const byKind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    return byKind !== 0 ? byKind : a.since.getTime() - b.since.getTime();
  });
}

export function workspaceAttention(
  users: { id: string; name: string; mustChangePassword: boolean }[],
): WorkspaceAttentionItem[] {
  return users
    .filter((u) => u.mustChangePassword)
    .map((u) => ({
      userId: u.id,
      name: u.name,
      reason: "Still signing in with a password an admin issued",
    }));
}
```

- [ ] **Step 4: Run the attention test to verify it passes**

Run: `pnpm vitest run tests/unit/attention.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Write the failing activity test**

Create `tests/unit/activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FEED_ACTIONS, activitySentence } from "@/lib/activity";

describe("activitySentence", () => {
  it("writes a sentence for every action the feed shows", () => {
    for (const action of FEED_ACTIONS) {
      const sentence = activitySentence({ action, actorName: "Jack", subjectName: "Amira" });
      expect(sentence).toBeTruthy();
      // No raw action code may leak into the feed.
      expect(sentence).not.toContain(action);
    }
  });

  it("drops actions the hiring feed does not show", () => {
    expect(activitySentence({ action: "admin.login", actorName: "Jack", subjectName: null })).toBeNull();
    expect(activitySentence({ action: "data.purged", actorName: "Jack", subjectName: null })).toBeNull();
    expect(activitySentence({ action: "user.password_changed", actorName: "Jack", subjectName: null })).toBeNull();
  });

  it("names a deleted candidate without exposing an identifier", () => {
    const sentence = activitySentence({
      action: "assessment.submitted",
      actorName: null,
      subjectName: null,
    })!;
    expect(sentence).toContain("record was deleted");
    expect(sentence).not.toMatch(/c[a-z0-9]{20,}/);
  });

  it("falls back gracefully when the actor is unknown", () => {
    const sentence = activitySentence({
      action: "export.downloaded",
      actorName: null,
      subjectName: null,
    })!;
    expect(sentence.startsWith("Someone")).toBe(true);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/activity.test.ts`
Expected: FAIL — cannot resolve `@/lib/activity`.

- [ ] **Step 7: Write `src/lib/activity.ts`**

```ts
/**
 * Audit actions rendered as sentences.
 *
 * Audit rows store identifiers only (build-skill invariant 6). Names are resolved by
 * the caller from the live User and Candidate tables and passed in — nothing here
 * reads or writes an identity, and a purged candidate degrades to a phrase rather
 * than a dangling id.
 *
 * Sign-ins, password changes and purges are deliberately absent: the first two are
 * noise on a hiring feed, and purge belongs on the data page.
 */
export const FEED_ACTIONS = [
  "invite.created",
  "invite.resent",
  "invite.revoked",
  "candidate.consented",
  "assessment.submitted",
  "result.viewed",
  "export.downloaded",
] as const;

const UNKNOWN_ACTOR = "Someone";
const DELETED_SUBJECT = "a candidate whose record was deleted";

export function activitySentence({
  action,
  actorName,
  subjectName,
}: {
  action: string;
  actorName: string | null;
  subjectName: string | null;
}): string | null {
  const who = actorName ?? UNKNOWN_ACTOR;
  const whom = subjectName ?? DELETED_SUBJECT;

  switch (action) {
    case "invite.created":
      return `${who} invited ${whom}`;
    case "invite.resent":
      return `${who} resent the invitation to ${whom}`;
    case "invite.revoked":
      return `${who} revoked the invitation for ${whom}`;
    case "candidate.consented":
      return `${whom} gave consent`;
    case "assessment.submitted":
      return `${whom} submitted their assessment`;
    case "result.viewed":
      return `${who} reviewed the profile for ${whom}`;
    case "export.downloaded":
      return `${who} exported the results`;
    default:
      return null;
  }
}
```

- [ ] **Step 8: Run the activity test to verify it passes**

Run: `pnpm vitest run tests/unit/activity.test.ts`
Expected: PASS, all cases.

- [ ] **Step 9: Run the whole unit suite and the invariant check**

Run: `pnpm test`
Expected: all files pass, previous 87 tests plus the new ones.

Run **bare**, not piped: `bash .claude/skills/afenda-talents-build/check-invariants.sh`
Expected: every mechanical invariant `ok`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/attention.ts src/lib/activity.ts tests/unit/attention.test.ts tests/unit/activity.test.ts
git commit -m "feat: state the attention rules and activity sentences as tested policy"
```

---

### Task 9: The Overview facade

**Files:**
- Create: `src/components/overview/round-summary.tsx`
- Create: `src/components/overview/workflow-strip.tsx`
- Create: `src/components/overview/attention-list.tsx`
- Create: `src/components/overview/recent-completions.tsx`
- Create: `src/components/overview/activity-feed.tsx`
- Create: `src/components/overview/empty-round.tsx`
- Modify: `src/app/admin/(shell)/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: everything produced by Tasks 2, 3, 5, and 8.
- Produces: the Overview. Nothing consumes it.

**The Danger Zone must not appear here** — it lives on `/admin/data` (Task 7). The candidate table must not appear here — it lives on `/admin/candidates` (Task 6).

- [ ] **Step 1: Write the shared relative-time helper and RoundSummary**

Create `src/components/overview/round-summary.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

/**
 * Durations, not clock times. The server runs UTC while the hiring team is UTC+8, so
 * a rendered wall-clock time — or a "Good morning" — would frequently be wrong. A
 * difference between two instants is timezone-independent, so it is safe on the server.
 */
export function relativeTime(from: Date, now: Date): string {
  const minutes = Math.round((now.getTime() - from.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function untilTime(target: Date, now: Date): string {
  const hours = Math.max(0, Math.round((target.getTime() - now.getTime()) / 3_600_000));
  if (hours < 1) return "in under an hour";
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export function RoundSummary({
  firstName,
  total,
  ready,
  needsAttention,
  lastActivityAt,
  now,
  isAdmin,
}: {
  firstName: string;
  total: number;
  ready: number;
  needsAttention: number;
  lastActivityAt: Date | null;
  now: Date;
  isAdmin: boolean;
}) {
  const sentence = [
    `${total} candidate${total === 1 ? "" : "s"} in this hiring round`,
    ready > 0 ? `${ready} ready for review` : null,
    needsAttention > 0 ? `${needsAttention} needing follow-up` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <PageHeader
      eyebrow="Hiring overview"
      title={`Welcome back, ${firstName}`}
      description={`${sentence}.`}
      meta={
        lastActivityAt && (
          <span className="text-muted-foreground">
            Last activity {relativeTime(lastActivityAt, now)}
          </span>
        )
      }
      actions={
        <>
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/candidates" />}>
            View all candidates
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" nativeButton={false} render={<a href="/api/admin/export" />}>
                Export results
              </Button>
              <Button nativeButton={false} render={<Link href="/admin/invite" />}>
                Invite candidates
              </Button>
            </>
          )}
        </>
      }
    />
  );
}
```

- [ ] **Step 2: Write WorkflowStrip**

Create `src/components/overview/workflow-strip.tsx`:

```tsx
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { STAGE_EXPLANATION, WORKFLOW_STAGES, statusDisplay } from "@/lib/status-display";

/**
 * Current-state distribution: each candidate is counted once, under the stage matching
 * their present status. Not a conversion funnel — no stage-transition history is stored,
 * so "ever reached this stage" is unknowable and is not claimed.
 */
export function WorkflowStrip({
  counts,
  exceptions,
}: {
  counts: Record<string, number>;
  exceptions: { status: string; count: number }[];
}) {
  const base = WORKFLOW_STAGES.reduce((sum, stage) => sum + (counts[stage] ?? 0), 0);
  const activeExceptions = exceptions.filter((e) => e.count > 0);

  return (
    <section aria-labelledby="workflow-heading" className="flex flex-col gap-3">
      <h2 id="workflow-heading" className="text-sm font-medium">
        Where candidates are now
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WORKFLOW_STAGES.map((stage) => {
          const count = counts[stage] ?? 0;
          const percent = base === 0 ? 0 : Math.round((count / base) * 100);
          return (
            <Card key={stage} className="transition-colors hover:border-ring">
              <CardContent className="flex flex-col gap-1">
                <Link
                  href={`/admin/candidates?status=${stage}`}
                  className="text-sm font-medium underline-offset-4 hover:underline focus-visible:underline"
                >
                  {statusDisplay(stage).label}
                </Link>
                <p className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{count}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {percent}% of {base}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{STAGE_EXPLANATION[stage]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {activeExceptions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Outside the round:{" "}
          {activeExceptions.map((e, i) => (
            <span key={e.status}>
              {i > 0 && " · "}
              <Link
                href={`/admin/candidates?status=${e.status}`}
                className="underline underline-offset-4"
              >
                <span className="tabular-nums">{e.count}</span> {statusDisplay(e.status).label.toLowerCase()}
              </Link>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Write AttentionList**

Create `src/components/overview/attention-list.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttentionItem, WorkspaceAttentionItem } from "@/lib/attention";
import { relativeTime, untilTime } from "@/components/overview/round-summary";

/**
 * A prioritised queue of things a person must decide about, ordered by operational
 * urgency alone — never by anything about a candidate's answers.
 */
export function HiringAttention({ items, now }: { items: AttentionItem[]; now: Date }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs your attention</CardTitle>
        <CardDescription>
          Nothing here is sent automatically. Each item is a decision for a person.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nothing needs following up right now.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={`${item.kind}-${item.candidateId}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-attention">{item.reason}</span>
                    {" · "}
                    {item.kind === "expiring"
                      ? untilTime(item.since, now)
                      : relativeTime(item.since, now)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link
                      href={
                        item.kind === "awaiting-review"
                          ? `/admin/candidate/${item.candidateId}`
                          : "/admin/candidates"
                      }
                    />
                  }
                >
                  {item.kind === "awaiting-review" ? "Review profile" : "Open candidate"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Kept separate from hiring attention so the hiring workflow stays legible. */
export function WorkspaceAttention({ items }: { items: WorkspaceAttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>Access and account housekeeping.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((item) => (
            <li
              key={item.userId}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-attention">{item.reason}</p>
              </div>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/admin/users" />}>
                Open team
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Write RecentCompletions**

Create `src/components/overview/recent-completions.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DimensionScore } from "@/lib/scoring";

export type CompletedProfile = {
  id: string;
  fullName: string;
  submittedAt: Date | null;
  dimensions: DimensionScore[];
  contextCount: number;
};

/**
 * Five separate dimension readings — never a total, a rank, or an ordering by score
 * (build-skill invariant 9). Colour encodes nothing: every bar uses the same neutral
 * tone, and the value and band are text, so the meaning survives greyscale printing
 * and colour-blind readers alike.
 */
function DimensionPips({ dimensions }: { dimensions: DimensionScore[] }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {dimensions.map((d) => (
        <li key={d.code} className="min-w-14">
          <span className="sr-only">
            {d.code}: {d.scaled} out of 100, {d.band} band.
          </span>
          <span aria-hidden="true" className="block font-mono text-[10px] text-muted-foreground">
            {d.code}
          </span>
          <span aria-hidden="true" className="mt-1 block h-1 w-full rounded-full bg-muted">
            <span
              className="block h-1 rounded-full bg-chart-5"
              style={{ width: `${Math.max(0, Math.min(100, d.scaled))}%` }}
            />
          </span>
          <span aria-hidden="true" className="mt-1 block text-xs tabular-nums">
            {d.scaled}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RecentCompletions({ profiles }: { profiles: CompletedProfile[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recently completed</CardTitle>
        <CardDescription>
          Five dimensions per candidate. There is no overall score and no ranking — each
          profile is one input into a hiring decision.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {profiles.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No completed assessments yet.
          </p>
        ) : (
          <ul className="divide-y">
            {profiles.map((p) => (
              <li key={p.id} className="flex flex-wrap items-end justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Completed {p.submittedAt?.toLocaleDateString("en-GB") ?? "—"} ·{" "}
                    {p.contextCount === 0
                      ? "no response-context indicators"
                      : `${p.contextCount} of 4 response-context indicators to review`}
                  </p>
                  <div className="mt-3">
                    <DimensionPips dimensions={p.dimensions} />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/admin/candidate/${p.id}`} />}
                >
                  Review profile
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Write ActivityFeed**

Create `src/components/overview/activity-feed.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { relativeTime } from "@/components/overview/round-summary";

export type ActivityEntry = { id: string; sentence: string; at: Date };

export function ActivityFeed({ entries, now }: { entries: ActivityEntry[]; now: Date }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>What has happened in this round.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nothing has happened yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm">{entry.sentence}</span>
                <span className="text-xs text-muted-foreground">{relativeTime(entry.at, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Write EmptyRound**

Create `src/components/overview/empty-round.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    title: "Add candidate details",
    body: "A name and an email for each person you want to assess.",
  },
  {
    title: "Review the invitation",
    body: "Preview the exact email each candidate receives before anything is sent.",
  },
  {
    title: "Send personal links",
    body: "Every candidate gets a one-time link that expires. No accounts, no passwords.",
  },
];

/**
 * The steps are numbered because they are a genuine sequence — you cannot send before
 * you add. Six zero-valued cards and an empty table would tell a first-time manager
 * nothing (requirements §6.3).
 */
export function EmptyRound({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Start this hiring round</CardTitle>
        <CardDescription>
          Afenda Talents invites candidates to a short self-assessment and turns their
          answers into a five-dimension profile you can review.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-1">
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-medium">{step.title}</span>
              <span className="text-sm text-muted-foreground">{step.body}</span>
            </li>
          ))}
        </ol>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/admin/invite" />}>
              Invite your first candidates
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/admin/invite" />}>
              Preview the invitation email
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: Rewrite the Overview page**

Replace `src/app/admin/(shell)/page.tsx` entirely:

```tsx
import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import { EXCEPTION_STAGES } from "@/lib/status-display";
import { hiringAttention, workspaceAttention, type CandidateFacts } from "@/lib/attention";
import { FEED_ACTIONS, activitySentence } from "@/lib/activity";
import type { DimensionScore, ValidityFlag } from "@/lib/scoring";
import { RoundSummary } from "@/components/overview/round-summary";
import { WorkflowStrip } from "@/components/overview/workflow-strip";
import { HiringAttention, WorkspaceAttention } from "@/components/overview/attention-list";
import { RecentCompletions, type CompletedProfile } from "@/components/overview/recent-completions";
import { ActivityFeed, type ActivityEntry } from "@/components/overview/activity-feed";
import { EmptyRound } from "@/components/overview/empty-round";

export const dynamic = "force-dynamic";

/**
 * The operational overview (DECISIONS.md D17): read-only, derived entirely from rows the
 * system already writes. No new tracked event, no ranking, no composite score, and no
 * destructive control — purge lives on /admin/data, the registry on /admin/candidates.
 */
export default async function AdminOverviewPage() {
  const session = await requireHiringUser();
  const isAdmin = session.role === "ADMIN";
  const now = new Date();

  const [candidates, responseActivity, viewEvents, feedEvents, users] = await Promise.all([
    db.candidate.findMany({ include: { result: true }, orderBy: { createdAt: "asc" } }),
    db.response.groupBy({ by: ["candidateId"], _max: { updatedAt: true } }),
    db.auditEvent.findMany({
      where: { action: "result.viewed" },
      select: { subjectId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.auditEvent.findMany({
      where: { action: { in: [...FEED_ACTIONS] } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.user.findMany({ select: { id: true, name: true, mustChangePassword: true } }),
  ]);

  const me = users.find((u) => u.id === session.userId);
  const firstName = (me?.name ?? "there").split(" ")[0];

  const lastResponseAt = new Map(responseActivity.map((r) => [r.candidateId, r._max.updatedAt]));
  // Ordered newest-first, so the first hit per subject is the latest view.
  const lastViewedAt = new Map<string, Date>();
  for (const event of viewEvents) {
    if (event.subjectId && !lastViewedAt.has(event.subjectId)) {
      lastViewedAt.set(event.subjectId, event.createdAt);
    }
  }

  const facts: CandidateFacts[] = candidates.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    status: c.status,
    sentAt: c.sentAt,
    openedAt: c.openedAt,
    startedAt: c.startedAt,
    expiresAt: c.expiresAt,
    lastResponseAt: lastResponseAt.get(c.id) ?? null,
    computedAt: c.result?.computedAt ?? null,
    lastViewedAt: lastViewedAt.get(c.id) ?? null,
  }));

  const attention = hiringAttention(facts, now);
  const workspace = workspaceAttention(users);

  const counts: Record<string, number> = {};
  for (const c of candidates) counts[c.status] = (counts[c.status] ?? 0) + 1;
  const exceptions = EXCEPTION_STAGES.map((status) => ({ status, count: counts[status] ?? 0 }));

  const completed: CompletedProfile[] = candidates
    .filter((c) => c.status === "SCORED" && c.result)
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      fullName: c.fullName,
      submittedAt: c.submittedAt,
      dimensions: c.result!.dimensionScores as unknown as DimensionScore[],
      contextCount: (c.result!.validityFlags as unknown as ValidityFlag[]).filter((f) => f.triggered)
        .length,
    }));

  // Names are resolved here, from the live tables — audit rows still store ids only.
  const userNames = new Map(users.map((u) => [u.id, u.name]));
  const candidateNames = new Map(candidates.map((c) => [c.id, c.fullName]));
  const entries: ActivityEntry[] = feedEvents
    .map((event) => {
      const sentence = activitySentence({
        action: event.action,
        actorName: userNames.get(event.actor) ?? null,
        subjectName: event.subjectId ? (candidateNames.get(event.subjectId) ?? null) : null,
      });
      return sentence ? { id: event.id, sentence, at: event.createdAt } : null;
    })
    .filter((entry): entry is ActivityEntry => entry !== null);

  const lastActivityAt = feedEvents[0]?.createdAt ?? null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <RoundSummary
        firstName={firstName}
        total={candidates.length}
        ready={counts.SCORED ?? 0}
        needsAttention={attention.length}
        lastActivityAt={lastActivityAt}
        now={now}
        isAdmin={isAdmin}
      />

      {candidates.length === 0 ? (
        <EmptyRound isAdmin={isAdmin} />
      ) : (
        <>
          <WorkflowStrip counts={counts} exceptions={exceptions} />
          <div className="grid gap-6 lg:grid-cols-2">
            <HiringAttention items={attention} now={now} />
            <ActivityFeed entries={entries} now={now} />
          </div>
          <RecentCompletions profiles={completed} />
          <WorkspaceAttention items={workspace} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Verify no destructive control survived the move**

Run: `grep -rn "DangerZone" "src/app/admin/(shell)/page.tsx"`
Expected: no output.

- [ ] **Step 9: Verify it compiles and lints**

Run: `pnpm typecheck && pnpm lint`
Expected: both silent.

If `db.response.groupBy` complains about a missing `orderBy`, add `orderBy: { candidateId: "asc" }` — Prisma requires the grouped field to be orderable in some configurations.

- [ ] **Step 10: Commit**

```bash
git add src/components/overview "src/app/admin/(shell)/page.tsx"
git commit -m "feat: rebuild the overview as an operational summary (D17)"
```

---

### Task 10: Loading and error states

**Files:**
- Create: `src/app/admin/(shell)/loading.tsx`
- Create: `src/app/admin/(shell)/error.tsx`

**Interfaces:**
- Consumes: `Skeleton` from `src/components/ui/skeleton.tsx`.
- Produces: nothing other tasks consume.

A single pair at the route-group level covers every shell page, which is where the shared chrome lives. Next.js applies them to nested segments automatically.

- [ ] **Step 1: Write the skeleton**

Create `src/app/admin/(shell)/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the page it replaces — never a full-page spinner (requirements §15.1). */
export default function ShellLoading() {
  return (
    <div className="flex flex-col gap-6 p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the error boundary**

Create `src/app/admin/(shell)/error.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * States what failed, whether anything was saved, and what to do next — and never shows
 * the underlying message, which can carry identifiers (requirements §15.2).
 */
export default function ShellError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg p-6">
      <Card>
        <CardHeader>
          <CardTitle>This page could not be loaded</CardTitle>
          <CardDescription>
            Nothing was changed and no candidate data was affected.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            This is usually temporary. Try again — if it keeps happening, sign out and back
            in.
          </p>
          <div>
            <Button onClick={reset}>Try again</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both silent.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(shell)/loading.tsx" "src/app/admin/(shell)/error.tsx"
git commit -m "feat: add shell loading skeletons and an error boundary"
```

---

### Task 11: Update the end-to-end specs

**Files:**
- Modify: `tests/e2e/02-invitations.spec.ts:30-35,46-51,66-76`
- Modify: `tests/e2e/06-export-audit-purge.spec.ts:103`
- Modify: `tests/e2e/07-rbac.spec.ts:36-41`

**Interfaces:**
- Consumes: the routes and labels from Tasks 2, 6, and 7.

- [ ] **Step 1: Point `02-invitations` at the registry and the new vocabulary**

In `tests/e2e/02-invitations.spec.ts`, every `await page.goto("/admin");` that is followed by a row lookup becomes `await page.goto("/admin/candidates");`. Then replace the status assertions:

```ts
  await expect(amira).toContainText("Invitation sent");
  await expect(daniel).toContainText("Invitation sent");
```

```ts
  await expect(row).toContainText("Invitation revoked");
```

```ts
  await expect(row).toContainText("Invitation sent");
```

- [ ] **Step 2: Point the purge test at the data page**

In `tests/e2e/06-export-audit-purge.spec.ts`, line 103, change:

```ts
  await page.goto("/admin");
```

to:

```ts
  // Purge lives on its own page now — requirements §11.1 keeps it off the daily dashboard.
  await page.goto("/admin/data");
```

Leave line 37 alone: that test navigates to `/admin` only to generate audit activity, and the overview still serves that.

- [ ] **Step 3: Point the RBAC read assertion at the registry**

In `tests/e2e/07-rbac.spec.ts`, replace the read-check block:

```ts
  // Reads work: the registry shows the candidate…
  await viewer.goto("/admin/candidates");
  await expect(viewer.getByRole("row", { name: new RegExp(`seen\\+${stamp}`) })).toBeVisible();
  // …but every mutating control is absent.
  await expect(viewer.getByRole("button", { name: "Invite candidates" })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "Revoke" })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "Delete all candidate data" })).toHaveCount(0);
```

- [ ] **Step 4: Add a viewer redirect assertion for the new admin page**

Immediately after the existing users-page redirect check in `tests/e2e/07-rbac.spec.ts`:

```ts
  // The data page bounces viewers back to the overview too.
  await viewer.goto("/admin/data");
  await expect(viewer).toHaveURL(/\/admin$/);
```

- [ ] **Step 5: Run the full end-to-end suite**

Run: `pnpm test:e2e`
Expected: all 20 specs pass. Paste the output.

If a run fails on a race rather than an assertion, re-run only the affected file with `pnpm dotenv -e .env.test -- playwright test tests/e2e/<file>` before changing any code.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e
git commit -m "test: follow the registry, data page, and readable status labels"
```

---

### Task 12: Accessibility and responsive verification

**Files:**
- Modify: whichever files the checks below find fault with.

- [ ] **Step 1: Start a dev server for this session**

Use `preview_start` with the project's `.claude/launch.json` entry. Do not use a shell command, and do not run a second server against a `.next` directory another session is already using.

- [ ] **Step 2: Check the landmark and heading structure on the overview**

Read the page's accessibility tree. Confirm exactly one `main`, a single `h1` from `PageHeader`, and `h2` section headings beneath it. Confirm the active navigation row carries `aria-current="page"`.

- [ ] **Step 3: Check keyboard traversal**

Tab from the top of `/admin`. Confirm the skip link appears first and focuses the main region, every nav row and button shows a visible focus ring, and the account menu opens with Enter and closes with Escape.

- [ ] **Step 4: Check the mobile drawer**

Resize to the mobile preset. Confirm the sidebar becomes a drawer, its trigger is reachable, navigation labels remain text (never icon-only), and no horizontal scrollbar appears on the overview.

- [ ] **Step 5: Confirm the profile still prints without admin chrome**

Load a scored candidate profile and confirm the sidebar and header carry `print:hidden`, so the print output has no navigation.

- [ ] **Step 6: Run the whole verification set and paste every output**

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

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: accessibility and responsive corrections from the Priority 1 review"
```

---

## Definition of done

Every box above is ticked, and the outputs of `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`check-invariants.sh`, and `pnpm test:e2e` have each been pasted — not predicted. The acceptance
criteria in §12 of the design document all hold.

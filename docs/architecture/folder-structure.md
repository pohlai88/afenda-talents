# Folder Structure

Source: [https://shadcnstudio.com/docs/documentation-admin/folder-structure](https://shadcnstudio.com/docs/documentation-admin/folder-structure)

Understand how the [shadcn admin template](https://shadcnstudio.com/templates/admin-dashboard) separates routes, views, shared components, configuration, demo data, and customization points.

> **Heads up:**
>
> Use this structure as the base reference for the Admin Dashboard Template. If you remove a feature, also remove its related route, view, config entry, mock data, and store code.

## Overview

Before checking folder structure it is better you know some stuff related to folder structure.

- `src/app` folder contains the Next.js App Router routes, layouts, route handlers, and server actions.
- Afenda admin shell routes live in `src/app/admin/(shell)` (sidebar, header, footer).
- Afenda blank (no-shell) routes live in `src/app/admin/(blank)` — login and change-password.
- Afenda does **not** use `src/views` for page UI (AdminCN pattern). Routes compose `src/components` instead — see `src/views/index.ts`.
- Afenda does **not** use `src/fake-db`. Seed and mutate real data via Prisma (`prisma/seed.ts`, `src/lib/db.ts`).
- `src/components` folder contains shared components, layouts, providers, and reusable UI which you can modify however you like.
- `src/configs` folder contains template configuration like navigation and feature settings. Update these files first before editing layout components directly.

## Admin Dashboard Template structure

The complete folder structure is shown in a single tree so you can see how root files, route groups, source folders, and customization areas relate to each other.

```
admin-template/
|-- public/                                    # Static assets served from the site root
|   |-- images/                                # Public images, logos, and media
|-- src/                                       # Application source code
|   |-- app/                                   # Next.js App Router routes and layouts
|   |   |-- favicon.ico                        # Browser favicon
|   |   |-- globals.css                        # Tailwind CSS, CSS variables, and theme tokens
|   |   |-- layout.tsx                         # Root layout, fonts, metadata, and providers
|   |   |-- not-found.tsx                      # Custom 404 page
|   |   |-- server/                            # Server Actions and server-only helpers
|   |   |-- api/                               # Route handlers used by demo features
|   |   |-- admin/(shell)/                     # Hiring shell (sidebar + header)
|   |   |-- admin/(blank)/                     # Login, change-password, onboarding, misc status
|   |   |-- a/[token]/                        # Candidate assessment (token auth)
|   |   |-- api/                               # Admin + candidate route handlers
|   |   |-- not-found.tsx                      # App 404
|   |   |-- error.tsx                          # Root error boundary (500)
|   |-- assets/                                # Static helpers (Afenda-trimmed AdminCN assets)
|   |   |-- data/search.ts                      # Command-palette workspace shortcuts
|   |   |-- svg/logo.tsx                        # Afenda AT mark
|   |   |-- index.ts
|   |-- components-v2/                         # Canonical UI (Shadcn Studio + base-nova primitives)
|   |   |-- ui/                                 # Official shadcn CLI install target
|   |   |-- shadcn-studio/                      # Studio variants + blocks (CLI / MCP)
|   |   |-- LEGACY-MIGRATION.md                 # How to consume v2 vs legacy
|   |-- components/                            # LEGACY — live app still imports here; do not extend
|   |   |-- LEGACY.md                           # Deprecation notice
|   |   |-- layout/                             # Sidebar, header, footer, and shell pieces
|   |   |-- shared/                             # Logo, activity dialog, notifications, profile menu
|   |   |-- admin-header/                       # Breadcrumb, language, search dialog internals
|   |   |-- ui/                                 # Legacy shadcn/ui primitives (frozen)
|   |   |-- providers.tsx                       # Theme + settings + tooltip wrapper
|   |   |-- theme-provider.tsx                  # next-themes wrapper
|   |-- configs/                               # Shell configuration files
|   |   |-- nav-config.tsx                      # Sidebar menu structure and role gating
|   |   |-- theme-config.ts                     # Theme / appearance defaults
|   |   |-- mail-config.ts                      # Invitation email helpers
|   |   |-- index.ts                            # Barrel exports
|   |-- contexts/                              # React context state shared across the app
|   |-- fake-db/                               # Intentionally empty (Prisma seed replaces demos)
|   |   |-- index.ts                            # Documents omitted AdminCN mock modules
|   |-- hooks/                                 # Client hooks (settings, mobile, pagination, file upload)
|   |   |-- use-settings.ts
|   |   |-- use-object-cookie.ts
|   |   |-- use-mobile.ts
|   |   |-- use-pagination.ts
|   |   |-- use-file-upload.ts
|   |   |-- index.ts
|   |-- lib/                                   # Domain + shell helpers (auth, scoring, shell search, cn, …)
|   |   |-- utils.ts                            # cn() class merge (shadcn)
|   |   |-- nav-apps.ts                         # Static workspace shortcuts (no /api/nav-apps)
|   |   |-- settings-cookie.ts                  # Server read of appearance cookie
|   |   |-- nav-active.ts                       # Sidebar active-path matching
|   |-- store/                                 # Intentionally empty (no Zustand demo apps)
|   |   |-- index.ts                            # Documents omitted AdminCN stores
|   |-- types/                                 # Shell/theme type surfaces (no demo app types)
|   |   |-- theme.ts                            # CSS-variable theme contract
|   |   |-- shell.ts                            # Re-exports hiring/settings/nav types
|   |   |-- index.ts
|   |-- utils/                                 # (unused — prefer lib/)
|   |-- views/                                 # Intentionally empty (no AdminCN view split)
|   |   |-- index.ts                            # Maps omitted views → app/ + components/
|-- .env.example                               # Environment variable reference
|-- components.json                            # shadcn/ui aliases and registry config
|-- eslint.config.mjs                          # ESLint configuration
|-- next.config.ts                             # Next.js configuration
|-- package.json                               # Scripts and dependencies
|-- postcss.config.mjs                         # Tailwind CSS v4 PostCSS setup
|-- tsconfig.json                              # TypeScript compiler and path aliases
|-- vercel.json                                # Vercel deployment configuration
```

## Main folders and files

These root-level folders and files are the first places to check when installing, configuring, or deploying the template.

| Folder/File | Description |
| --- | --- |
| `public` | Stores static files that Next.js serves directly from the site root, such as images, icons, logos, and favicons. |
| `src` | Contains the actual application source: routes, views, components, configuration, mock data, hooks, stores, and utilities. |
| `.env.example` | Lists the environment variables expected by the template. Copy the required keys into your local .env file during setup. |
| `components.json` | Defines shadcn/ui configuration, aliases, registry settings, and paths used when adding or updating UI components. |
| `next.config.ts` | Controls Next.js behavior such as image settings, build options, redirects, or deployment-specific config. |
| `eslint.config.mjs` | Defines ESLint rules and project linting behavior. |
| `package.json` | Contains scripts, dependencies, dev dependencies, and package manager metadata for the Admin Dashboard Template. |
| `postcss.config.mjs` | Configures PostCSS for Tailwind CSS v4 processing. |
| `tsconfig.json` | Defines TypeScript compiler options and path aliases used throughout the project. |
| `vercel.json` | Contains deployment configuration for Vercel when the template is hosted there. |

## Understanding the app folder

The `src/app` folder controls routing, layouts, route groups, global styles, server actions, and route handlers. Keep route files focused on routing and move larger UI into views.

| Folder/File | Description |
| --- | --- |
| `src/app/layout.tsx` | The root layout wraps every route with fonts, metadata, theme handling, settings, and application providers. |
| `src/app/globals.css` | The global stylesheet for Tailwind CSS, theme variables, sidebar tokens, chart colors, radius, and dark mode values. |
| `src/app/(pages)` | The main admin route group. It contains dashboard, apps, datatable, forms, and content pages rendered inside the dashboard shell. |
| `src/app/(blank)` | A minimal route group for screens that should not show the admin shell, such as auth, onboarding, and misc error pages. |
| `src/app/api` | Route handlers for demo APIs or integration points that run on the server. |
| `src/app/server` | Server Actions and server-only helpers used by demo features. Replace or extend this layer when connecting real services. |
| `src/app/not-found.tsx` | The custom 404 screen rendered when a route cannot be matched. |

## Understanding the source folders

The rest of `src` is organized by responsibility. This separation helps you customize one layer without accidentally changing unrelated dashboard screens.

| Folder/File | Description |
| --- | --- |
| `src/assets` | Afenda search shortcuts + logo SVG. Calendar/demo SVGs omitted (see `src/assets/index.ts`). |
| `src/components-v2` | Canonical install root: `ui/` (primitives) + `shadcn-studio/` (Studio reference variants). See [UI-LAYERS.md](../../src/components-v2/UI-LAYERS.md). |
| `src/components` | **Legacy** — still powers the live app. Frozen for new UI; migrate surfaces to `components-v2` in follow-up PRs. |
| `src/configs` | Central place for template configuration. Navigation, menus, labels, and feature constants should be updated here first. |
| `src/contexts` | React context modules for app-wide state that needs to be read by many components without prop drilling. |
| `src/fake-db` | AdminCN-only mocks. Afenda uses `prisma/seed.ts` + Postgres (see `src/fake-db/index.ts`). |
| `src/hooks` | Reusable hooks for shared client-side behavior. Use this folder for logic that is needed by more than one view or component. |
| `src/lib` | General-purpose utilities and shared helpers, including class name merging and other foundation-level functions. |
| `src/store` | Zustand stores for interactive app features such as calendar, chat, contact, kanban, mail, roles, and users. |
| `src/types` | Shared TypeScript types and interfaces used across routes, views, components, stores, and mock data. |
| `src/utils` | Feature-specific utility functions that support dashboards, apps, settings, tables, and other template flows. |
| `src/views` | AdminCN-only pattern. Afenda uses `src/app` routes + `src/components` (see `src/views/index.ts`). |

## Where to make common changes

Use this table as a practical guide when customizing the Admin Dashboard Template. Start from the narrowest folder that owns the change, then update related route, config, or data files only when needed.

| Task | Update | Notes |
| --- | --- | --- |
| Add a new admin page | `src/app/admin/(shell), src/components, src/configs/nav-config.tsx` | Create the route under the admin shell, put reusable UI in components, then add the nav item. |
| Change sidebar navigation | `src/configs/navConfig.tsx` | Update menu groups, labels, icons, paths, nested items, and external links from the navigation config before editing layout code. |
| Update theme and branding | `src/app/globals.css, src/configs/themeConfig.ts, components.json, public` | Change design tokens, radius, chart colors, sidebar colors, logos, favicons, and shadcn/ui aliases from these files. |
| Seed / replace data | `prisma/seed.ts`, `prisma/schema.prisma`, `src/app/api` | Use Prisma seed and API handlers — not client fake-db modules. |
| Add / update shadcn or Studio UI | `src/components-v2`, `components.json` | CLI aliases → v2; relocate Studio files after install. See [LEGACY-MIGRATION.md](../../src/components-v2/LEGACY-MIGRATION.md). |
| Edit shared UI (legacy) | `src/components` | Retired for new UI; promote v2 → `components` when migration completes. |
| Edit one page only | `src/app/.../page.tsx` and its feature components | Prefer colocated page + `src/components/<feature>` over a separate views tree. |

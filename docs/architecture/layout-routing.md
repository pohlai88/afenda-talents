# Layout & Routing

Source: [https://shadcnstudio.com/docs/documentation-admin/layout-routing](https://shadcnstudio.com/docs/documentation-admin/layout-routing)

The [shadcn admin dashboard](https://shadcnstudio.com/templates/admin-dashboard) uses Next.js App Router route groups to separate the full dashboard shell from blank auth pages.

## Layout files and Route groups

The template uses one root layout and two route-group layouts. This keeps the dashboard shell separate from authentication pages.

| File | Purpose | Used by |
| --- | --- | --- |
| `src/app/layout.tsx` | Root providers, fonts, cookies, theme setup, and global app structure. | Every route in the app. |
| `src/app/(pages)/layout.tsx` | Full admin shell with sidebar, header, footer, and content area. | Dashboards, apps, forms, settings, and utility pages. |
| `src/app/(blank)/layout.tsx` | Minimal layout without the admin shell. | Authentication pages and full-screen standalone flows. |

## Main route areas

| Route | Content |
| --- | --- |
| `(pages)/dashboard/*` | Sales, finance, logistics, productivity, campaign, analytics, payments, e-commerce, and orders dashboards. |
| `(pages)/apps/*` | Calendar, chat, contact, kanban, and mail applications. |
| `(pages)/pages/*` | FAQ, pricing, empty states, user settings, forms, and data table demos. |
| `(blank)/pages/auth/*` | Login, register, forgot password, verify email, reset password, and two-step variants. |

## Adding a route

1. Create a route folder inside `src/app/(pages)`.
2. Create a matching view in `src/views` for the page UI.
3. Add the item to `src/configs/navConfig.tsx` to include it in the sidebar. .
4. Include it in `src/assets/data/search.ts` to make it searchable and enable quick navigation to the page.

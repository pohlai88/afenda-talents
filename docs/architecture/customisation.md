# Customization

Source: [https://shadcnstudio.com/docs/documentation-admin/customization](https://shadcnstudio.com/docs/documentation-admin/customization)

Customize the [shadcn admin dashboard template](https://shadcnstudio.com/templates/admin-dashboard) by updating theme config, design tokens, navigation, branding, routes, and demo content.

## Theme config

The main theme defaults are controlled from `src/configs/themeConfig.ts`. Update this file when you want to change the default template name, home route, theme preset, font, radius, scale, layout, or sidebar behavior.

```ts
const themeConfig = {
  templateName: 'AdminCN', // App name
  homePageUrl: '/dashboard/sales', // Default landing page
  settingsCookieName: 'shadcn-next-admin-settings', // Customizer cookie key
  mode: 'system', // Default color mode
  themePreset: 'default', // Default theme preset
  font: 'geist', // Default font family
  radius: 'md', // Default border radius
  scale: 'md', // Default UI scale
  layout: 'compact', // Default content layout
  sidebarVariant: 'default', // Sidebar style
  sidebarCollapsible: 'icon', // Sidebar collapse behavior
  sidebarOpen: true // Sidebar initial state
} as const
```

## Theme config options

| Option | Values | Purpose |
| --- | --- | --- |
| templateName | String | Controls the product name shown in template surfaces. |
| homePageUrl | Route path | Defines the default page users should land on after entering the app. |
| settingsCookieName | String | Sets the cookie key used to persist customizer settings. |
| mode | system, light, dark | Sets the default color mode before the user changes it. |
| themePreset | default, caffeine, claude, corporate, ghibli-studio, marvel, material-design, modern-minimal, nature, perplexity, slack, pastel-dreams | Controls the default theme preset used by the admin UI. |
| font | geist, inter, roboto, nunito-sans, lora, geist-mono, space-grotesk, josefin-sans, poppins, open-sans, montserrat, raleway, ubuntu, noto-sans, archivo variants | Controls the default font family used across the template. |
| radius | none, sm, md, lg | Controls the default component border radius. |
| scale | sm, md, lg | Controls the default UI density and sizing scale. |
| layout | compact, full | Controls whether page content uses a constrained or full-width layout. |
| sidebarVariant | default, inset, floating | Controls the visual style of the dashboard sidebar. |
| sidebarCollapsible | offcanvas, icon, none | Controls how the sidebar collapses on supported layouts. |
| sidebarOpen | true, false | Sets whether the sidebar is open by default. |

## Changing the default theme

- Get CSS variables for your theme from /utils/themePresets.ts and update `src/app/globals.css` to change the default theme preset.
- Change `font`, `radius`, and `scale` when you want a different default visual style.
- Change `layout`, `sidebarVariant`, `sidebarCollapsible`, and `sidebarOpen` when you want to adjust the default dashboard shell.

## Common customization areas

| Area | Where to update | What changes |
| --- | --- | --- |
| Theme | `src/configs/themeConfig.ts` and `src/app/globals.css` | Default theme settings, theme presets, radius, scale, chart colors, sidebar tokens, light mode, and dark mode. |
| Navigation | `src/configs/navConfig.tsx` | Sidebar groups, links, icons, external links, and nested menu items. |
| Branding | Logo, favicon, metadata, auth pages | App name, visual identity, social preview text, and auth page brand surfaces. |
| Pages | `src/app` and `src/views` | Routes, page layouts, sections, and feature-specific UI. |
| Command palette | `src/assets/data/search.ts` | Quick navigation results and searchable admin actions. |

## Recommended order

1. Update brand logo, favicon, and metadata.
2. Update `themeConfig` defaults for template name, home route, theme preset, font, layout, and sidebar.
3. Remove dashboard pages, apps, and demos your product does not need.
4. Update sidebar navigation and command palette entries.
5. Replace mock data with your own data layer after the UI structure is stable.

## Adding a new page

1. Create a new view folder inside `src/views/new-page`.
2. Create a matching route inside `src/app/(pages)/new-page/page.tsx`.
3. Import the view in the `/new-page` route.
4. Add the menu item to `src/configs/navConfig.tsx`.
5. Optionally add in `src/assets/data/search.ts` for the command palette.

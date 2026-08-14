# Dependencies

Source: [https://shadcnstudio.com/docs/documentation-admin/dependencies](https://shadcnstudio.com/docs/documentation-admin/dependencies)

A category-wise reference of the main packages used by the [shadcn admin dashboard](https://shadcnstudio.com/templates/admin-dashboard).

> **Heads up:**
>
> The following dependencies are used by the template features. Remove a package only after removing the pages, components, or flows that depend on it.

## Core framework

```json
"next" // App Router framework, routing, layouts, server features
"react" // Component-based UI rendering
"react-dom" // React browser rendering package
"typescript" // Type-safe development across the template
```

## UI & styling

```json
"shadcn" // shadcn/ui CLI and registry workflow
"@base-ui/react" // Accessible unstyled UI primitives
"tailwindcss" // Utility-first styling and design tokens
"@tailwindcss/postcss" // Tailwind CSS v4 PostCSS integration
"tw-animate-css" // Animation utilities for Tailwind CSS
"class-variance-authority" // Component variant class management
"clsx" // Conditional class name composition
"tailwind-merge" // Merge and dedupe Tailwind utility classes
"lucide-react" // Icon set used across the interface
"next-themes" // Light, dark, and system theme handling
"motion" // UI animation and transitions
```

## Forms & validation

```json
"react-hook-form" // Performant form state and field handling
"@hookform/resolvers" // Connect validation schemas to React Hook Form
"zod" // Type-safe schema validation
"@stepperize/react" // Multi-step form and wizard flows
"input-otp" // One-time password input fields
"react-payment-inputs" // Payment card input formatting
"react-19-credit-card" // Credit card preview and payment UI
```

## Data, tables & state

```json
"@tanstack/react-table" // Sorting, filtering, pagination, and data tables
"recharts" // Dashboard charts and analytics visualizations
"papaparse" // CSV parsing and export support
"xlsx" // Excel file export support
"zustand" // Lightweight client state management
"nuqs" // URL query state for tabs, filters, and shareable state
```

## Interactive features

```json
"@dnd-kit/core" // Drag and drop interaction engine
"@dnd-kit/sortable" // Sortable drag and drop lists
"@dnd-kit/modifiers" // Drag constraints and movement modifiers
"@dnd-kit/utilities" // Drag and drop helper utilities
"react-day-picker" // Calendar and date picker UI
"date-fns" // Date formatting and date utilities
"react-aria-components" // Accessible React interaction primitives
"react-use" // Reusable React hooks
"react-resizable-panels" // Resizable split-panel layouts
"embla-carousel-react" // Carousel and slider interactions
```

## UI utilities

```json
"cmdk" // Command palette and searchable command menu
"vaul" // Drawer component behavior
"sonner" // Toast notifications
"three" // 3D rendering support where needed
```

## Development tools

```json
"eslint" // Code linting
"eslint-config-next" // Next.js ESLint rules
"eslint-config-prettier" // Disables ESLint rules that conflict with Prettier
"@stylistic/eslint-plugin" // Stylistic linting rules
"prettier" // Code formatting
"prettier-plugin-tailwindcss" // Tailwind class sorting in formatted files
"@types/node" // TypeScript types for Node.js
"@types/react" // TypeScript types for React
"@types/react-dom" // TypeScript types for React DOM
"@types/papaparse" // TypeScript types for Papa Parse
"@types/react-payment-inputs" // TypeScript types for payment inputs
```

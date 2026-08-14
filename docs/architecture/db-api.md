# How to Remove Fake DB and Use Real API

Source: [https://shadcnstudio.com/docs/documentation-admin/remove-fake-db-use-real-api](https://shadcnstudio.com/docs/documentation-admin/remove-fake-db-use-real-api)

The [shadcn admin template](https://shadcnstudio.com/templates/admin-dashboard) includes fake database files, demo API routes, and Server Actions so the UI works before you connect a backend. For production, remove those mock layers and fetch data from your real API.

> **Before you delete files:**
>
> Remove only the demo data layer. If you have already added real API routes, real Server Actions, or production service files, keep those files and delete only the fake-data references.

## What you are replacing

Start by identifying which files still depend on the fake data layer. Most projects need to replace the following areas:

| Source | Remove | Replace with |
| --- | --- | --- |
| `src/fake-db` | Mock records and seed data | Your API response, database query result, or CMS data. |
| `src/app/api` | Demo route handlers that read fake data | Your real REST, GraphQL, or backend-for-frontend endpoints. |
| `src/app/server` | Server Actions connected to fake data | Service functions, API clients, ORM calls, or authenticated server logic. |
| `src/views, src/app, src/store` | Imports and calls that depend on fake data actions | Real fetch calls, query hooks, or state mutations backed by your API. |

## 1. Remove the fake DB

Delete the `src/fake-db` folder from your project. This folder contains mock data used by dashboards, apps, settings, tables, and other demo screens before API integration.

## 2. Remove fake API routes

Delete the fake route handlers inside `src/app/api` that were only created to serve mock data. If every route in that folder belongs to the demo layer, you can remove the whole `src/app/api` folder.

## 3. Remove Server Actions

Delete the demo Server Actions from `src/app/server`. These actions are used to interact with fake data and should be replaced with your API client, database layer, or service functions.

## 4. Clean up import statements

Search inside `src/app`, `src/views`, and `src/store` for imports from `@/app/server/actions`. Remove those imports and the function calls that depend on them.

```tsx
import { getUsers } from '@/app/server/actions'
```

## 5. Update data fetching logic

In the files where you removed Server Action imports, replace the fake-data calls with requests to your real API. If the template includes commented fetch examples, uncomment them and update the URL, headers, cache behavior, and response handling for your backend.

```tsx
const response = await fetch(process.env.API_BASE_URL + '/users', {
  cache: 'no-store'
})

if (!response.ok) {
  throw new Error('Failed to fetch users')
}

const users = await response.json()
```

## 6. Verify data structures

Make sure your real API returns the same fields the UI expects. If your API response shape is different, update the response mapper, TypeScript types, table columns, forms, charts, and empty states to match the new data structure.

## Final check

- Run the app and open each page that previously used fake data.
- Confirm loading, error, empty, and success states work with real API responses.
- Search for any remaining references to `fake-db`.
- Run type checking and a production build before deployment.

That's it. You have removed the fake DB layer and configured the Admin Dashboard Template to fetch data from your real API.

import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * CLI configuration only — the running app builds its own adapter in src/lib/db.ts.
 *
 * Migrations use Neon's DIRECT endpoint: Prisma Migrate takes advisory locks and issues
 * DDL that PgBouncer's transaction pooling cannot carry. Pointing the CLI at the pooled
 * endpoint fails in ways that look like network faults. See DECISIONS.md D1.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});

import "dotenv/config";
import { defineConfig } from "prisma/config";
import { stabilizePgUrl } from "./src/lib/pg-url";

/**
 * CLI configuration only — the running app builds its own adapter in src/lib/db.ts.
 *
 * Migrations use Neon's DIRECT endpoint: Prisma Migrate takes advisory locks and issues
 * DDL that PgBouncer's transaction pooling cannot carry. Pointing the CLI at the pooled
 * endpoint fails in ways that look like network faults. See DECISIONS.md D1.
 */
const direct = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!direct) {
	throw new Error("DIRECT_URL or DATABASE_URL is required for Prisma CLI");
}

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
		seed: "tsx prisma/seed.ts",
	},
	datasource: {
		url: stabilizePgUrl(direct),
	},
});

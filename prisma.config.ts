import "dotenv/config";
import { defineConfig } from "prisma/config";
import { stabilizePgUrl } from "./src/lib/pg-url";

/**
 * CLI configuration only — the running app builds its own adapter in src/lib/db.ts.
 *
 * Migrations use Neon's DIRECT endpoint: Prisma Migrate takes advisory locks and issues
 * DDL that PgBouncer's transaction pooling cannot carry. Pointing the CLI at the pooled
 * endpoint fails in ways that look like network faults. See DECISIONS.md D1.
 *
 * `prisma generate` does not connect to the database. Vercel preview installs may not
 * receive database credentials, so generation is allowed to use a non-routable local
 * placeholder while every migration/seed command still fails closed without a real URL.
 */
const direct = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const isGenerate = process.argv.some((arg) => arg === "generate");
if (!direct && !isGenerate) {
	throw new Error("DIRECT_URL or DATABASE_URL is required for Prisma CLI");
}

const cliUrl = direct ?? "postgresql://prisma:prisma@127.0.0.1:5432/prisma";

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
		seed: "tsx prisma/seed.ts",
	},
	datasource: {
		url: stabilizePgUrl(cliUrl),
	},
});

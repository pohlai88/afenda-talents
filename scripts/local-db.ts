import EmbeddedPostgres from "embedded-postgres";

/**
 * Local development database: real PostgreSQL binaries on port 54329, holding the
 * `afenda` (dev) and `afenda_test` (e2e) databases. Run with `pnpm db:local` and leave
 * it running; stop with Ctrl+C. Data persists in .pgdata/ between runs.
 *
 * This replaced `prisma dev` after its PGlite proxy repeatedly reset connections under
 * the app pool + test client load — see DECISIONS.md D14.
 */
/**
 * Defaults to 54329. Override with LOCAL_DB_PORT when something else already
 * holds it — Docker Desktop, for instance, publishes a range through wslrelay
 * and will win the bind. Point DATABASE_URL at the same port when you do.
 */
const port = Number(process.env.LOCAL_DB_PORT ?? 54329);

const pg = new EmbeddedPostgres({
  databaseDir: "./.pgdata",
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
});

async function main() {
  const fresh = !(await import("node:fs")).existsSync("./.pgdata/PG_VERSION");
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) {
    await pg.createDatabase("afenda");
    await pg.createDatabase("afenda_test");
  }
  console.log(`local Postgres ready on postgres://postgres:postgres@localhost:${port}`);
  console.log("databases: afenda (dev), afenda_test (e2e). Ctrl+C to stop.");
}

async function shutdown() {
  await pg.stop().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch(async (error) => {
  console.error(error);
  await pg.stop().catch(() => {});
  process.exit(1);
});

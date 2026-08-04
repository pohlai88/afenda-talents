import { Client } from "pg";

/**
 * Runs once per test run, before the web server accepts traffic. Resets all mutable
 * state in the e2e database so runs are deterministic: previous runs' candidates,
 * rate-limit rows, and audit events do not leak into this one.
 *
 * Item rows (the seeded instrument) are deliberately left alone.
 */
async function globalSetup(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.on("error", () => {});
  await client.connect();
  // Candidate cascades to Response and Result via the schema's onDelete rules.
  await client.query('DELETE FROM "Candidate"');
  await client.query('DELETE FROM "LoginAttempt"');
  await client.query('DELETE FROM "AuditEvent"');
  await client.end();
}

export default globalSetup;

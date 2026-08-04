import { Client } from "pg";

/**
 * Deletes rate-limit rows so specs start unthrottled. The local `prisma dev` Postgres
 * multiplexes a single PGlite instance and occasionally drops a raw connection while the
 * app's pool is busy, so this retries rather than failing the whole spec file.
 */
export async function clearLoginAttempts(retries = 5): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    // The PGlite proxy sometimes resets the socket AFTER a successful query; without a
    // listener that async 'error' event crashes the whole worker outside any try/catch.
    client.on("error", () => {});
    try {
      await client.connect();
      await client.query('DELETE FROM "LoginAttempt"');
      await client.end();
      return;
    } catch (error) {
      await client.end().catch(() => {});
      if (attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

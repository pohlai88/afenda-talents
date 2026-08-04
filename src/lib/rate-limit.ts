import { db } from "@/lib/db";

/**
 * Login rate limiting backed by Postgres, because serverless instances share no memory —
 * an in-memory Map would give each lambda its own counter. See DECISIONS.md D3.
 */
export const MAX_FAILURES = 5;
export const WINDOW_MINUTES = 15;
const PRUNE_AFTER_MINUTES = 60;

/** True when this IP has already failed MAX_FAILURES times inside the window. */
export async function isRateLimited(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  const failures = await db.loginAttempt.count({ where: { ip, createdAt: { gte: since } } });
  return failures >= MAX_FAILURES;
}

/** Only failures are recorded — otherwise a working admin locks themselves out. */
export async function recordFailure(ip: string): Promise<void> {
  await db.loginAttempt.create({ data: { ip } });
  await db.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - PRUNE_AFTER_MINUTES * 60_000) } },
  });
}

/** A success clears the run, so the counter measures consecutive failures. */
export async function clearFailures(ip: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { ip } });
}

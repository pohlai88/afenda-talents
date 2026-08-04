import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing for hiring-side User accounts. scrypt from node:crypto — no extra
 * dependency, memory-hard, and synchronous use is fine at this scale (one login at a
 * time, not a public signup form). Stored form: scrypt$<salt-hex>$<hash-hex>.
 */
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = scryptSync(password, salt, KEY_LENGTH);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Temporary password for a newly created user, shown to the admin exactly once. */
export function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

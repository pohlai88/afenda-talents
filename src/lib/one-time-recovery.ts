import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Verify a high-entropy one-time token without storing or comparing the raw token.
 * The caller supplies only a SHA-256 digest committed to the temporary recovery route.
 */
export function matchesSha256Token(token: string, expectedHashHex: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(expectedHashHex)) return false;
  const expected = Buffer.from(expectedHashHex, "hex");
  const actual = createHash("sha256").update(token, "utf8").digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

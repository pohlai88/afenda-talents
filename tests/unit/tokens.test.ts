import { describe, it, expect } from "vitest";
import { generateToken, hashToken, inviteUrl, expiryFromNow } from "@/lib/tokens";

describe("generateToken", () => {
  it("produces a url-safe string with no padding", () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces 32 bytes of entropy", () => {
    expect(Buffer.from(generateToken(), "base64url")).toHaveLength(32);
  });

  it("never repeats across many draws", () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateToken()));
    expect(seen.size).toBe(1000);
  });
});

describe("hashToken", () => {
  it("is stable for the same input", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("differs for different inputs", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });

  it("does not contain the raw token", () => {
    const token = generateToken();
    expect(hashToken(token)).not.toContain(token);
  });

  it("produces a 64-character hex digest", () => {
    expect(hashToken("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("inviteUrl", () => {
  it("builds the candidate entry url", () => {
    expect(inviteUrl("https://x.test", "TOK")).toBe("https://x.test/a/TOK");
  });

  it("tolerates a trailing slash on the base url", () => {
    expect(inviteUrl("https://x.test/", "TOK")).toBe("https://x.test/a/TOK");
  });
});

describe("expiryFromNow", () => {
  it("adds whole days", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(expiryFromNow(14, now).toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });
});

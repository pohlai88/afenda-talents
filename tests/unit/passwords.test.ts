import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, generatePassword } from "@/lib/passwords";

describe("hashPassword / verifyPassword", () => {
  it("round-trips a password", () => {
    const hash = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("wrong-horse", hash)).toBe(false);
  });

  it("salts: the same password hashes differently twice", () => {
    expect(hashPassword("same-input")).not.toBe(hashPassword("same-input"));
  });

  it("never stores the plaintext inside the hash", () => {
    expect(hashPassword("visible-secret")).not.toContain("visible-secret");
  });

  it("rejects a malformed stored hash without throwing", () => {
    expect(verifyPassword("anything", "not-a-real-hash")).toBe(false);
    expect(verifyPassword("anything", "")).toBe(false);
  });
});

describe("generatePassword", () => {
  it("produces a url-safe secret of at least 16 characters", () => {
    const pw = generatePassword();
    expect(pw).toMatch(/^[A-Za-z0-9_-]{16,}$/);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generatePassword()));
    expect(seen.size).toBe(200);
  });
});

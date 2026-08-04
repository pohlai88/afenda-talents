import { describe, it, expect } from "vitest";
import { passwordMatches, createAdminToken, verifyAdminToken } from "@/lib/auth-admin";

describe("passwordMatches", () => {
  it("accepts the correct password", () => {
    expect(passwordMatches("correct-horse-battery-staple", "correct-horse-battery-staple")).toBe(
      true,
    );
  });

  it("rejects a wrong password", () => {
    expect(passwordMatches("wrong", "correct-horse-battery-staple")).toBe(false);
  });

  it("compares differing lengths without throwing", () => {
    // Both sides are hashed to a fixed width first, so timingSafeEqual never sees
    // mismatched buffer lengths (which would throw) and length is not leaked early.
    expect(passwordMatches("a", "correct-horse-battery-staple")).toBe(false);
    expect(passwordMatches("correct-horse-battery-stapleX", "correct-horse-battery-staple")).toBe(
      false,
    );
  });
});

describe("admin token", () => {
  it("round-trips a freshly minted token", async () => {
    expect(await verifyAdminToken(await createAdminToken())).toBe(true);
  });

  it("rejects undefined", async () => {
    expect(await verifyAdminToken(undefined)).toBe(false);
  });

  it("rejects a garbage token", async () => {
    expect(await verifyAdminToken("not.a.jwt")).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const { SignJWT } = await import("jose");
    const foreign = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode("an-entirely-different-secret-value"));
    expect(await verifyAdminToken(foreign)).toBe(false);
  });

  it("rejects a token whose role is not admin", async () => {
    const { SignJWT } = await import("jose");
    // Signed with the REAL secret but the wrong claim shape — e.g. a candidate token
    // pasted into the admin cookie. The two systems must not accept each other's tokens.
    const wrongRole = await new SignJWT({ candidateId: "cmf0abc" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode("0123456789abcdef0123456789abcdef"));
    expect(await verifyAdminToken(wrongRole)).toBe(false);
  });
});

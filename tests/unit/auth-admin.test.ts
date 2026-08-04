import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth-admin";

describe("hiring session token", () => {
  it("round-trips an ADMIN session", async () => {
    const token = await createSessionToken({ userId: "u1", role: "ADMIN" });
    expect(await verifySessionToken(token)).toEqual({ userId: "u1", role: "ADMIN" });
  });

  it("round-trips a VIEWER session", async () => {
    const token = await createSessionToken({ userId: "u2", role: "VIEWER" });
    expect(await verifySessionToken(token)).toEqual({ userId: "u2", role: "VIEWER" });
  });

  it("rejects undefined and garbage", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const { SignJWT } = await import("jose");
    const foreign = await new SignJWT({ userId: "u1", role: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode("an-entirely-different-secret-value"));
    expect(await verifySessionToken(foreign)).toBeNull();
  });

  it("rejects a candidate-shaped token signed with the real secret", async () => {
    // The two systems must not accept each other's tokens.
    const { SignJWT } = await import("jose");
    const wrongShape = await new SignJWT({ candidateId: "cmf0abc" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("4h")
      .sign(new TextEncoder().encode("0123456789abcdef0123456789abcdef"));
    expect(await verifySessionToken(wrongShape)).toBeNull();
  });

  it("rejects an invented role", async () => {
    const { SignJWT } = await import("jose");
    const badRole = await new SignJWT({ userId: "u1", role: "SUPERUSER" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode("0123456789abcdef0123456789abcdef"));
    expect(await verifySessionToken(badRole)).toBeNull();
  });
});

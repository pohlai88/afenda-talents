import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth-admin";

describe("hiring session token", () => {
  it("round-trips identity and revocation version", async () => {
    const token = await createSessionToken({ userId: "u1", sessionVersion: 3 });
    expect(await verifySessionToken(token)).toEqual({
      userId: "u1",
      sessionVersion: 3,
    });
  });

  it("accepts the initial version", async () => {
    const token = await createSessionToken({ userId: "u2", sessionVersion: 0 });
    expect(await verifySessionToken(token)).toEqual({
      userId: "u2",
      sessionVersion: 0,
    });
  });

  it("rejects undefined and garbage", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const { SignJWT } = await import("jose");
    const foreign = await new SignJWT({ userId: "u1", sessionVersion: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode("an-entirely-different-secret-value"));
    expect(await verifySessionToken(foreign)).toBeNull();
  });

  it("rejects a candidate-shaped token signed with the real secret", async () => {
    const { SignJWT } = await import("jose");
    const wrongShape = await new SignJWT({ assignmentId: "cmf0abc" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("4h")
      .sign(new TextEncoder().encode("0123456789abcdef0123456789abcdef"));
    expect(await verifySessionToken(wrongShape)).toBeNull();
  });

  it("rejects legacy role-only and malformed version claims", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode("0123456789abcdef0123456789abcdef");
    const legacy = await new SignJWT({ userId: "u1", role: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(secret);
    const negative = await new SignJWT({ userId: "u1", sessionVersion: -1 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(secret);
    expect(await verifySessionToken(legacy)).toBeNull();
    expect(await verifySessionToken(negative)).toBeNull();
  });
});

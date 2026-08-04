import { describe, it, expect } from "vitest";
import { assertNoPii } from "@/lib/audit";

describe("assertNoPii", () => {
  it("accepts non-identifying meta", () => {
    expect(() => assertNoPii({ count: 3, status: "SENT" })).not.toThrow();
  });

  it("accepts undefined", () => {
    expect(() => assertNoPii(undefined)).not.toThrow();
  });

  it("rejects a value that looks like an email address", () => {
    expect(() => assertNoPii({ who: "someone@example.com" })).toThrow(/email/i);
  });

  it("rejects an email nested inside an array", () => {
    expect(() => assertNoPii({ batch: ["a@b.co"] })).toThrow(/email/i);
  });

  it("rejects an email nested two objects deep", () => {
    expect(() => assertNoPii({ outer: { inner: "x@y.zz" } })).toThrow(/email/i);
  });

  it("rejects a key named email or fullName regardless of value", () => {
    expect(() => assertNoPii({ email: "redacted" })).toThrow();
    expect(() => assertNoPii({ fullName: "redacted" })).toThrow();
  });

  it("rejects anything that looks like a base64url token", () => {
    // A 32-byte base64url token is 43 characters.
    expect(() => assertNoPii({ t: "A".repeat(43) })).toThrow(/token/i);
  });

  it("accepts a cuid subject reference in meta", () => {
    expect(() => assertNoPii({ resentFor: "cmf0abc123xyz" })).not.toThrow();
  });

  it("accepts a sha256 token hash", () => {
    // 64 hex chars — the stored form is fine; only raw tokens are banned.
    expect(() => assertNoPii({ hash: "a".repeat(64) })).not.toThrow();
  });
});

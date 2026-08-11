import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { matchesSha256Token } from "@/lib/one-time-recovery";

describe("matchesSha256Token", () => {
  const token = "synthetic-recovery-token-that-is-safe-for-tests";
  const digest = createHash("sha256").update(token, "utf8").digest("hex");

  it("accepts the token matching the supplied digest", () => {
    expect(matchesSha256Token(token, digest)).toBe(true);
  });

  it("rejects another token", () => {
    expect(matchesSha256Token(`${token}-wrong`, digest)).toBe(false);
  });

  it("rejects malformed digests", () => {
    expect(matchesSha256Token(token, "not-a-sha256-digest")).toBe(false);
  });
});

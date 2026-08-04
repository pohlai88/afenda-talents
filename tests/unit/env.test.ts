import { describe, it, expect } from "vitest";
import { envSchema } from "@/lib/env";

const valid = {
  DATABASE_URL: "postgresql://u:p@h/db",
  DIRECT_URL: "postgresql://u:p@h/db",
  APP_URL: "http://localhost:3000",
  APP_SECRET: "0123456789abcdef0123456789abcdef",
  ADMIN_EMAIL: "hr@example.com",
  ADMIN_PASSWORD: "a-generated-password-of-24-plus",
  MAIL_FROM: "Afenda <no-reply@example.com>",
  INVITE_TTL_DAYS: "14",
  RETENTION_DAYS: "180",
};

describe("envSchema", () => {
  it("accepts a complete valid environment", () => {
    expect(envSchema.safeParse(valid).success).toBe(true);
  });

  function without(key: keyof typeof valid) {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest[key];
    return rest;
  }

  it("rejects a missing APP_SECRET", () => {
    expect(envSchema.safeParse(without("APP_SECRET")).success).toBe(false);
  });

  it("rejects a missing ADMIN_PASSWORD", () => {
    expect(envSchema.safeParse(without("ADMIN_PASSWORD")).success).toBe(false);
  });

  it("rejects an ADMIN_PASSWORD shorter than 24 characters", () => {
    // 23 characters — the boundary case.
    const result = envSchema.safeParse({ ...valid, ADMIN_PASSWORD: "short-password-23-chars" });
    expect(result.success).toBe(false);
  });

  it("accepts an ADMIN_PASSWORD of exactly 24 characters", () => {
    expect(
      envSchema.safeParse({ ...valid, ADMIN_PASSWORD: "exactly-24-characters-ok" }).success,
    ).toBe(true);
  });

  it("rejects an APP_SECRET shorter than 32 characters", () => {
    expect(envSchema.safeParse({ ...valid, APP_SECRET: "too-short" }).success).toBe(false);
  });

  it("coerces day counts to numbers", () => {
    const parsed = envSchema.parse(valid);
    expect(parsed.INVITE_TTL_DAYS).toBe(14);
    expect(parsed.RETENTION_DAYS).toBe(180);
  });

  it("defaults RESEND_API_KEY to an empty string so dev uses the console transport", () => {
    expect(envSchema.parse(valid).RESEND_API_KEY).toBe("");
  });
});

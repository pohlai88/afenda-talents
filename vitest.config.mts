import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Unit tests must run without a database and without a real .env, so valid
    // values are supplied here. lib/env.ts validates process.env at import time.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      DIRECT_URL: "postgresql://test:test@localhost:5432/test",
      APP_URL: "http://localhost:3000",
      APP_SECRET: "0123456789abcdef0123456789abcdef",
      ADMIN_EMAIL: "hr@example.com",
      ADMIN_PASSWORD: "unit-test-password-24-chars-long",
      MAIL_FROM: "Afenda Talents <noreply@example.com>",
      INVITE_TTL_DAYS: "14",
      RETENTION_DAYS: "180",
    },
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
});

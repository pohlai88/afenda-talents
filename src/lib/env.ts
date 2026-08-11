import { z } from "zod";

/**
 * Fails fast at boot. No defaults for APP_SECRET or ADMIN_PASSWORD in production — a
 * deploy without them must die loudly, not run guessably. Preview deployments are the
 * only exception: they receive non-routable database URLs and per-process random auth
 * material so Next.js can collect route metadata without exposing or simulating a
 * working hiring-admin login.
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
  APP_URL: z.url(),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z
    .string()
    .min(24, "ADMIN_PASSWORD must be at least 24 characters — generate it, do not choose it"),
  RESEND_API_KEY: z.string().default(""),
  MAIL_FROM: z.string().min(1),
  INVITE_TTL_DAYS: z.coerce.number().int().positive().default(14),
  RETENTION_DAYS: z.coerce.number().int().positive().default(180),
});

export type Env = z.infer<typeof envSchema>;

function previewEnvironment(): NodeJS.ProcessEnv {
  const nonce = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://preview:preview@127.0.0.1:1/preview",
    DIRECT_URL: process.env.DIRECT_URL ?? "postgresql://preview:preview@127.0.0.1:1/preview",
    APP_URL: process.env.APP_URL ?? "http://localhost:3000",
    APP_SECRET: process.env.APP_SECRET ?? `preview-disabled-${nonce}-${nonce}`,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "preview-disabled@example.invalid",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? `preview-disabled-${nonce}`,
    MAIL_FROM: process.env.MAIL_FROM ?? "preview-disabled@example.invalid",
  };
}

function load(): Env {
  const source = process.env.VERCEL_ENV === "preview" ? previewEnvironment() : process.env;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${detail}`);
  }
  return parsed.data;
}

export const env = load();

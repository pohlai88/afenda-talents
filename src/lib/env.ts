import { z } from "zod";

/**
 * Fails fast at boot. No defaults for APP_SECRET or ADMIN_PASSWORD — a deploy without
 * them must die loudly, not run guessably. The 24-character password floor is the primary
 * defence against distributed guessing of the single admin password; see DECISIONS.md D4.
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

function load(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${detail}`);
  }
  return parsed.data;
}

export const env = load();

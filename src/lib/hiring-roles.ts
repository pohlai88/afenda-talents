/**
 * Hiring-side role constants and types — safe to import from client components.
 * Server session logic lives in auth-admin.ts (uses next/headers).
 */
export const ROLES = ["ADMIN", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export type HiringSession = { userId: string; role: Role };

export const ADMIN_COOKIE = "afenda_admin";

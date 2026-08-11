/**
 * Hiring-side role constants and types — safe to import from client components.
 * Server session logic lives in auth-admin.ts (uses next/headers and the database).
 */
export const ROLES = ["ADMIN", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

/** Minimal signed claims. Current role and account state are always re-read from Postgres. */
export type HiringSessionClaims = {
  userId: string;
  sessionVersion: number;
};

/** Current database-backed authority returned to server pages and route handlers. */
export type HiringSession = HiringSessionClaims & {
  role: Role;
  mustChangePassword: boolean;
};

export const ADMIN_COOKIE = "afenda_admin";

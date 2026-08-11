import type { Role } from "@/lib/hiring-roles";

export type AdminLoginMode = "hiring" | "developer";

export function isLoginModeAllowed({
  mode,
  email,
  role,
  developerEmail,
}: {
  mode: AdminLoginMode;
  email: string;
  role: Role;
  developerEmail: string;
}): boolean {
  if (mode === "hiring") return true;

  return role === "ADMIN" && email.toLowerCase() === developerEmail.toLowerCase();
}

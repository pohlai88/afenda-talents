export const PAGE_AUTH_HEADERS = {
  authenticated: "x-afenda-authenticated",
  userId: "x-afenda-user-id",
  role: "x-afenda-role",
  sessionVersion: "x-afenda-session-version",
  mustChangePassword: "x-afenda-must-change-password",
} as const;

export const PAGE_AUTH_HEADER_NAMES = Object.values(PAGE_AUTH_HEADERS);

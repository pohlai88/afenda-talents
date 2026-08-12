// Generic internal-workspace auth facade for domains outside Talents.
// The underlying session implementation remains unchanged; this avoids spreading
// hiring-specific vocabulary into Corporate Administration (D19).
export {
  requireAdmin as requireWorkspaceAdmin,
  requireHiringUser as requireWorkspaceUser,
  type HiringSession as WorkspaceSession,
} from "@/lib/auth-admin";

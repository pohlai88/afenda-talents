import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShellClient } from "@/components/admin-shell-client";
import { db } from "@/lib/db";
import type { HiringSession } from "@/lib/hiring-roles";
import { requirePagePasswordChangeUser } from "@/lib/page-authority";
import { resolveOperationalRound } from "@/lib/round-context";

export const dynamic = "force-dynamic";

export default async function AdminShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  let session: HiringSession;
  try {
    session = await requirePagePasswordChangeUser();
  } catch {
    redirect("/admin/login");
  }

  if (session.mustChangePassword) redirect("/admin/change-password");

  const [user, roundContext] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true, role: true },
    }),
    resolveOperationalRound(),
  ]);
  if (!user) redirect("/admin/login");

  return (
    <AdminShellClient
      user={user}
      rounds={roundContext.rounds}
      selectedRoundId={roundContext.selected?.id ?? null}
    >
      {children}
    </AdminShellClient>
  );
}

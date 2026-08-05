import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-admin";
import { UserManager } from "@/components/user-manager";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin");
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <PageHeader
        eyebrow="Workspace"
        title="Hiring team"
        description="Admins invite, revoke, export and manage this list. Viewers can open the dashboard and candidate profiles, and change nothing."
      />
      <UserManager
        users={users}
        currentUserId={session.userId}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { UserManagerLoader } from "@/components/user-manager-loader";
import { requirePageAdmin } from "@/lib/page-authority";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  let session;
  try {
    session = await requirePageAdmin();
  } catch {
    redirect("/admin");
  }

  // eslint-disable-next-line react-hooks/purity -- force-dynamic request marker; router.refresh() must reload user context.
  const refreshNonce = Date.now();

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <PageHeader
        eyebrow="Workspace"
        title="Hiring team"
        description="Admins invite, revoke, export and manage this list. Viewers can open the dashboard and candidate profiles, and change nothing."
      />
      <UserManagerLoader
        currentUserId={session.userId}
        refreshNonce={refreshNonce}
      />
    </div>
  );
}

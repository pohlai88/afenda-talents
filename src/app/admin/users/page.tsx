import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-admin";
import { Button } from "@/components/ui/button";
import { UserManager } from "@/components/user-manager";

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
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hiring team</h1>
        <Button variant="outline" render={<Link href="/admin" />}>
          Back
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Admins can invite, revoke, export and manage this list. Viewers can open the dashboard
        and candidate profiles, and change nothing.
      </p>
      <UserManager users={users} currentUserId={session.userId} />
    </main>
  );
}

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import { ChangePasswordForm } from "@/components/change-password-form";

export const dynamic = "force-dynamic";

/**
 * Sits outside the (shell) route group on purpose: the shell refuses to render while
 * mustChangePassword is set and redirects here, so this page must not be wrapped by it.
 * Reachable voluntarily from the sidebar as well.
 */
export default async function ChangePasswordPage() {
  let session;
  try {
    session = await requireHiringUser();
  } catch {
    redirect("/admin/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, mustChangePassword: true },
  });
  if (!user) redirect("/admin/login");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <ChangePasswordForm email={user.email} forced={user.mustChangePassword} />
    </main>
  );
}

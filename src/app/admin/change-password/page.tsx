import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePasswordChangeUser } from "@/lib/auth-admin";
import {
  ChangePasswordForm,
  ForcedChangePasswordForm,
} from "@/components/change-password-form";

export const dynamic = "force-dynamic";

/**
 * This page sits outside the admin shell so a forced change can be completed before
 * operational navigation becomes available.
 */
export default async function ChangePasswordPage() {
  let session;
  try {
    session = await requirePasswordChangeUser();
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
      {user.mustChangePassword ? (
        <ForcedChangePasswordForm email={user.email} />
      ) : (
        <ChangePasswordForm email={user.email} />
      )}
    </main>
  );
}

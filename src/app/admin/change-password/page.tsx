import { redirect } from "next/navigation";
import { PasswordChangeWorkspaceLoader } from "@/components/password-change-workspace-loader";
import { requirePagePasswordChangeUser } from "@/lib/page-authority";

export const dynamic = "force-dynamic";

/**
 * This page sits outside the admin shell so a forced change can be completed before
 * operational navigation becomes available.
 */
export default async function ChangePasswordPage() {
  try {
    await requirePagePasswordChangeUser();
  } catch {
    redirect("/admin/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <PasswordChangeWorkspaceLoader />
    </main>
  );
}

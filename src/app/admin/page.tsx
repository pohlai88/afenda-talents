import { requireAdmin } from "@/lib/auth-admin";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Candidates</h1>
      <p className="mt-4 text-sm text-muted-foreground">No candidates invited yet.</p>
    </main>
  );
}

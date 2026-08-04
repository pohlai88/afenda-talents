import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-admin";
import { Button } from "@/components/ui/button";
import { CandidateRowActions } from "@/components/candidate-row-actions";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["SENT", "STARTED", "SUBMITTED", "SCORED", "EXPIRED", "REVOKED"] as const;

export default async function AdminDashboardPage() {
  await requireAdmin();

  const candidates = await db.candidate.findMany({ orderBy: { createdAt: "asc" } });
  const counts = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, candidates.filter((c) => c.status === s).length]),
  );

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Candidates</h1>
        <Button render={<Link href="/admin/invite" />}>Invite candidates</Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="rounded-md border px-3 py-2 text-sm">
            <span className="font-medium">{counts[status]}</span>{" "}
            <span className="text-muted-foreground">{status}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Name</th>
              <th className="pr-3">Email</th>
              <th className="pr-3">Status</th>
              <th className="pr-3">Invited</th>
              <th className="pr-3">Submitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} data-candidate-id={c.id} className="border-b">
                <td className="py-2 pr-3">
                  {c.status === "SCORED" ? (
                    <Link className="underline" href={`/admin/candidate/${c.id}`}>
                      {c.fullName}
                    </Link>
                  ) : (
                    c.fullName
                  )}
                </td>
                <td className="pr-3">{c.email}</td>
                <td className="pr-3">{c.status}</td>
                <td className="pr-3">{c.sentAt?.toLocaleDateString("en-GB") ?? "—"}</td>
                <td className="pr-3">{c.submittedAt?.toLocaleDateString("en-GB") ?? "—"}</td>
                <td className="text-right">
                  <CandidateRowActions id={c.id} status={c.status} />
                </td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-muted-foreground">
                  No candidates invited yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

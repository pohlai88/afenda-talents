import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-admin";
import { env } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DangerZone } from "@/components/danger-zone";

export const dynamic = "force-dynamic";

/**
 * Retention and deletion, kept away from the daily workflow: requirements §11.1 forbids
 * purge controls on the candidate dashboard. Audit exploration lands here in Priority 5.
 */
export default async function DataPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <PageHeader
        eyebrow="Workspace"
        title="Data & audit"
        description="What Afenda Talents keeps, for how long, and how to delete it."
      />

      <Card>
        <CardHeader>
          <CardTitle>Retention</CardTitle>
          <CardDescription>
            Candidates are told their responses are kept for {env.RETENTION_DAYS} days from
            submission.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Deletion is a manual step. Nothing expires on its own, so honouring the retention
            promise means coming here and running it.
          </p>
          <p className="text-muted-foreground">
            Deleting removes names, emails, answers and results. The audit log keeps a record
            that the deletion happened — identifiers and timestamps only, never a name or an
            email — so the retention promise stays provable after the data is gone.
          </p>
        </CardContent>
      </Card>

      <DangerZone retentionDays={env.RETENTION_DAYS} />
    </div>
  );
}

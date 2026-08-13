import Link from "next/link";

import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { PaymentHistoryImport } from "@/components/corporate/payment-history-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";

export const dynamic = "force-dynamic";

export default async function PaymentHistoryImportPage() {
  await requireWorkspaceAdmin();
  return (
    <AfendaPageFrame width="wide">
      <PageHeader
        eyebrow="Corporate Administration · Migration"
        title="Historical payment import"
        description="Load legacy payments without creating false new approvals. Match by agreement, line and due date; create missing due items when enough information exists; and commit valid rows even when other rows need correction."
      />
      <CorporateNav />

      <Card>
        <CardHeader>
          <CardTitle>Import controls</CardTitle>
          <CardDescription>This workflow is for already-made historical payments. New payments should continue through Request → Approve → Record → Reconcile.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>Historical rows are audit-labelled. Set <code>reconciled=true</code> only when the legacy evidence has already been independently verified; otherwise reconcile it from the obligation record later.</p>
          <div><Button variant="outline" nativeButton={false} render={<Link href="/admin/corporate/operations/import" />}>Back to import workspace</Button></div>
        </CardContent>
      </Card>

      <PaymentHistoryImport />
    </AfendaPageFrame>
  );
}

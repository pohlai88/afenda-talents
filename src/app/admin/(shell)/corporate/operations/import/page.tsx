import Link from "next/link";

import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { SafeImportAssistant } from "@/components/corporate/safe-import-assistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";

export const dynamic = "force-dynamic";

export default async function CorporateSafeImportPage() {
  await requireWorkspaceAdmin();
  return (
    <AfendaPageFrame width="wide">
      <PageHeader
        eyebrow="Corporate Administration · Operations"
        title="Safe paste & import"
        description="Choose the record grain first, then let Afenda parse, validate, preview every change, fingerprint the plan and reject stale transactions before anything is committed."
      />
      <CorporateNav />
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Agreement Lines</CardTitle><CardDescription>Amounts, schedules, dates, notes and optional Site links keyed by agreement + line code.</CardDescription></CardHeader>
          <CardContent><Button nativeButton={false} render={<Link href="/admin/corporate/operations/import" />}>Current workspace</Button></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Sites</CardTitle><CardDescription>Location master data keyed by Site code, including address, timezone, coordinates and active status.</CardDescription></CardHeader>
          <CardContent><Button variant="outline" nativeButton={false} render={<Link href="/admin/corporate/operations/import/sites" />}>Import Sites</Button></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Counterparties</CardTitle><CardDescription>Counterparty master data keyed by code, including registration, tax, contact and payment defaults.</CardDescription></CardHeader>
          <CardContent><Button variant="outline" nativeButton={false} render={<Link href="/admin/corporate/operations/import/counterparties" />}>Import Counterparties</Button></CardContent>
        </Card>
      </div>
      <SafeImportAssistant />
    </AfendaPageFrame>
  );
}

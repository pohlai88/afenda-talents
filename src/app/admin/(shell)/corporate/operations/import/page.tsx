import Link from "next/link";

import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { SafeImportAssistant } from "@/components/corporate/safe-import-assistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";

export const dynamic = "force-dynamic";

const relationshipImports = [
  { href:"/admin/corporate/operations/import/relations/contacts", title:"Counterparty Contacts", description:"Counterparty + email identity, including primary-contact conflict detection." },
  { href:"/admin/corporate/operations/import/relations/coverage", title:"Service Coverage", description:"Site ↔ Counterparty service relationships with primary-provider conflict detection." },
  { href:"/admin/corporate/operations/import/relations/sites", title:"Obligation ↔ Site", description:"Agreement applicability across one or many operating locations." },
  { href:"/admin/corporate/operations/import/relations/parties", title:"Obligation ↔ Party", description:"Agreement participants and business roles with competing-primary review." },
] as const;

export default async function CorporateSafeImportPage() {
  await requireWorkspaceAdmin();
  return (
    <AfendaPageFrame width="wide">
      <PageHeader
        eyebrow="Corporate Administration · Operations"
        title="Safe paste & import"
        description="Choose the record grain first, then let Afenda parse, resolve, validate, preview, fingerprint and transactionally commit without spreadsheet ambiguity."
      />
      <CorporateNav />

      <section className="flex flex-col gap-3" aria-labelledby="master-imports">
        <div><h2 id="master-imports" className="text-lg font-semibold">Records & commercial lines</h2><p className="text-sm text-muted-foreground">Import scalar master data or agreement-line schedules using stable record codes.</p></div>
        <div className="grid gap-3 md:grid-cols-3">
          <Card><CardHeader><CardTitle>Agreement Lines</CardTitle><CardDescription>Amounts, schedules, dates, notes and additive Site links keyed by agreement + line code.</CardDescription></CardHeader><CardContent><Button nativeButton={false} render={<Link href="/admin/corporate/operations/import" />}>Current workspace</Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Sites</CardTitle><CardDescription>Location master data keyed by Site code, including address, timezone, coordinates and active status.</CardDescription></CardHeader><CardContent><Button variant="outline" nativeButton={false} render={<Link href="/admin/corporate/operations/import/sites" />}>Import Sites</Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Counterparties</CardTitle><CardDescription>Counterparty master data keyed by code, including registration, tax, contact and payment defaults.</CardDescription></CardHeader><CardContent><Button variant="outline" nativeButton={false} render={<Link href="/admin/corporate/operations/import/counterparties" />}>Import Counterparties</Button></CardContent></Card>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="relationship-imports">
        <div><h2 id="relationship-imports" className="text-lg font-semibold">Relationships</h2><p className="text-sm text-muted-foreground">Resolve both endpoints and review duplicate/conflicting natural keys before any relationship is written.</p></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {relationshipImports.map(item=><Card key={item.href}><CardHeader><CardTitle>{item.title}</CardTitle><CardDescription>{item.description}</CardDescription></CardHeader><CardContent><Button variant="outline" nativeButton={false} render={<Link href={item.href}/>}>Import relationship</Button></CardContent></Card>)}
        </div>
      </section>

      <SafeImportAssistant />
    </AfendaPageFrame>
  );
}

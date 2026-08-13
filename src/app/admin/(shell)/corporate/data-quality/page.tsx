import Link from "next/link";

import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { DataQualityTaskButton } from "@/components/corporate/data-quality-task-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { evaluateCorporateDataQuality, type QualitySnapshot } from "@/lib/corporate-admin/data-quality";
import { formatDateOnly } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CorporateDataQualityPage() {
  const session = await requireWorkspaceUser();
  const [sites, counterparties, obligations] = await Promise.all([
    db.administrativeSite.findMany({
      orderBy: { code: "asc" },
      select: {
        id:true,code:true,name:true,type:true,isActive:true,organization:true,city:true,countryCode:true,timezone:true,
        serviceCoverage:{select:{id:true,counterpartyId:true,serviceCategory:true,roleCode:true,isPrimary:true,isActive:true}},
      },
    }),
    db.administrativeCounterparty.findMany({
      orderBy:{code:"asc"},
      select:{id:true,code:true,name:true,type:true,isActive:true,registrationNo:true,taxId:true,countryCode:true,defaultCurrency:true,paymentTermsDays:true,contacts:{select:{id:true,email:true,isPrimary:true,isActive:true}}},
    }),
    db.administrativeObligation.findMany({
      orderBy:{code:"asc"},
      select:{id:true,code:true,title:true,category:true,organization:true,status:true,counterpartyId:true,contractRequired:true,contractReference:true,contractFileUrl:true,sites:{select:{siteId:true,isActive:true}},parties:{select:{counterpartyId:true,roleCode:true,isPrimary:true,isActive:true}},lines:{select:{id:true,code:true,name:true,recurring:true,nextDueDate:true,isActive:true}}},
    }),
  ]);

  const snapshot: QualitySnapshot = {
    sites: sites.map(site=>({
      id:site.id,code:site.code,name:site.name,type:site.type,isActive:site.isActive,organization:site.organization,city:site.city,countryCode:site.countryCode,timezone:site.timezone,
      coverage:site.serviceCoverage,
    })),
    counterparties,
    obligations: obligations.map(ob=>({...ob,status:String(ob.status),lines:ob.lines.map(line=>({...line,nextDueDate:line.nextDueDate?formatDateOnly(line.nextDueDate):null}))})),
  };
  const result = evaluateCorporateDataQuality(snapshot);
  const actions = result.findings.filter(f=>f.severity==="ACTION").length;
  const reviews = result.findings.filter(f=>f.severity==="REVIEW").length;
  const below80 = result.completeness.filter(item=>item.percent<80).length;
  const isAdmin = session.role === "ADMIN";

  return (
    <AfendaPageFrame width="wide">
      <PageHeader eyebrow="Corporate Administration · Data Quality" title="Data quality control centre" description="Detect ambiguous relationships, incomplete operational context and deterministic data conflicts before they become spreadsheet-style cleanup work." />
      <CorporateNav />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader><CardDescription>Action findings</CardDescription><CardTitle className="text-3xl tabular-nums">{actions}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Duplicate/conflicting state that should be resolved.</CardContent></Card>
        <Card><CardHeader><CardDescription>Review findings</CardDescription><CardTitle className="text-3xl tabular-nums">{reviews}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Potential gaps that may be legitimate but deserve operator review.</CardContent></Card>
        <Card><CardHeader><CardDescription>Profiles below 80%</CardDescription><CardTitle className="text-3xl tabular-nums">{below80}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Checklist completeness only—this is not a risk score.</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Findings queue</CardTitle><CardDescription>Every finding is generated from an explicit rule and links to the record that can resolve it. Admins can promote a finding into accountable Administrative Work without changing the underlying rule.</CardDescription></CardHeader>
        <CardContent>{result.findings.length===0?<p className="text-sm text-muted-foreground">No current deterministic data-quality findings.</p>:<div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Priority</TableHead><TableHead>Rule</TableHead><TableHead>Record</TableHead><TableHead>Finding</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{result.findings.map(item=><TableRow key={item.id}><TableCell><Badge variant={item.severity==="ACTION"?"destructive":"outline"}>{item.severity}</Badge></TableCell><TableCell className="font-mono text-xs">{item.rule}</TableCell><TableCell><div className="font-medium">{item.entityCode}</div><div className="text-xs text-muted-foreground">{item.entityType}</div></TableCell><TableCell><div className="font-medium">{item.title}</div><div className="max-w-2xl text-xs text-muted-foreground">{item.detail}</div></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2">{isAdmin?<DataQualityTaskButton findingId={item.id} title={item.title} detail={item.detail} href={item.href} severity={item.severity}/>:null}<Button size="sm" variant="outline" nativeButton={false} render={<Link href={item.href}/>}>Review record</Button></div></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Profile completeness</CardTitle><CardDescription>Simple checklist ratios with visible components. A lower percentage means known profile elements are missing, not that Afenda has inferred business risk.</CardDescription></CardHeader>
        <CardContent><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Record</TableHead><TableHead>Type</TableHead><TableHead>Complete</TableHead><TableHead>Missing checks</TableHead><TableHead className="text-right">Open</TableHead></TableRow></TableHeader><TableBody>{result.completeness.map(item=><TableRow key={`${item.entityType}:${item.entityCode}`}><TableCell><div className="font-medium">{item.label}</div><div className="font-mono text-xs text-muted-foreground">{item.entityCode}</div></TableCell><TableCell>{item.entityType}</TableCell><TableCell><div className="flex items-center gap-2"><Badge variant={item.percent<60?"destructive":item.percent<100?"secondary":"outline"}>{item.percent}%</Badge><span className="text-xs text-muted-foreground">{item.complete}/{item.total}</span></div></TableCell><TableCell className="text-xs">{item.checks.filter(check=>!check.complete).map(check=>check.label).join(", ")||"Complete"}</TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" nativeButton={false} render={<Link href={item.href}/>}>Open</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent>
      </Card>
    </AfendaPageFrame>
  );
}

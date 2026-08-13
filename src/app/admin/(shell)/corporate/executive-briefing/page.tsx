import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { listAutomationRuns } from "@/lib/corporate-admin/automation-server";
import { buildExecutiveBriefing } from "@/lib/corporate-admin/executive-briefing";
import { listWorkItems } from "@/lib/corporate-admin/work-items-server";

export const dynamic = "force-dynamic";

export default async function CorporateExecutiveBriefingPage() {
  await requireWorkspaceUser();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Kuala_Lumpur", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
  const [items,runs]=await Promise.all([listWorkItems(),listAutomationRuns(20)]);
  const briefing=buildExecutiveBriefing(items,today);
  const metrics=[
    ["Open",briefing.open,"Unresolved administrative work"],
    ["Overdue",briefing.overdue,"Past target date"],
    ["Escalated",briefing.escalated,"Current escalation > 0"],
    ["Unassigned",briefing.unassigned,"No accountable owner"],
    ["Due 7 days",briefing.due7d,"Upcoming commitments"],
    ["Closure 30d",`${briefing.closureRate30d}%`,`${briefing.resolved30d} resolved / ${briefing.created30d} created`],
  ] as const;

  return <AfendaPageFrame width="wide">
    <PageHeader eyebrow="Corporate Administration · Executive Briefing" title="Executive administration briefing" description="Management exceptions, aging, owner workload and closure performance derived directly from authoritative Administrative Work." />
    <CorporateNav />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{metrics.map(([label,value,description])=><Card key={label}><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-3xl tabular-nums">{value}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{description}</CardContent></Card>)}</div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Open-work aging</CardTitle><CardDescription>Age since the Administrative Work item was created. This is operational aging, not a risk score.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3"><Aging label="< 3 days" value={briefing.aging.under3}/><Aging label="3–6 days" value={briefing.aging.days3to6}/><Aging label="7–13 days" value={briefing.aging.days7to13}/><Aging label="14+ days" value={briefing.aging.days14plus}/><div className="col-span-2 text-sm text-muted-foreground">Median resolution time, last 30 days: <strong className="text-foreground">{briefing.medianResolutionDays30d ?? "n/a"} days</strong></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Owner workload</CardTitle><CardDescription>Current unresolved workload plus recent closure output. Unassigned work is shown deliberately.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Owner</TableHead><TableHead className="text-right">Open</TableHead><TableHead className="text-right">Overdue</TableHead><TableHead className="text-right">Escalated</TableHead><TableHead className="text-right">Resolved 30d</TableHead></TableRow></TableHeader><TableBody>{briefing.owners.map(owner=><TableRow key={owner.ownerId??"unassigned"}><TableCell className="font-medium">{owner.ownerName}</TableCell><TableCell className="text-right tabular-nums">{owner.open}</TableCell><TableCell className="text-right tabular-nums">{owner.overdue}</TableCell><TableCell className="text-right tabular-nums">{owner.escalated}</TableCell><TableCell className="text-right tabular-nums">{owner.resolved30d}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Recurring automation evidence</CardTitle><CardDescription>Daily and weekly scheduler outcomes. Automation evidence does not replace the underlying Work Item or reminder-delivery records.</CardDescription></CardHeader><CardContent>{runs.length===0?<p className="text-sm text-muted-foreground">No scheduled Corporate automation runs have been recorded yet.</p>:<div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Run</TableHead><TableHead>Status</TableHead><TableHead>Work created</TableHead><TableHead>Escalations</TableHead><TableHead>In-app reminders</TableHead><TableHead>Digest</TableHead></TableRow></TableHeader><TableBody>{runs.map(run=><TableRow key={run.id}><TableCell><div className="font-medium">{run.jobType}</div><div className="font-mono text-xs text-muted-foreground">{run.runKey}</div></TableCell><TableCell><Badge variant={run.status==="COMPLETED"?"outline":run.status==="PARTIAL"?"secondary":"destructive"}>{run.status}</Badge></TableCell><TableCell>{run.workItemsCreated}</TableCell><TableCell>{run.escalationsChanged}</TableCell><TableCell>{run.remindersCreated}</TableCell><TableCell>{run.digestSent}/{run.digestRecipients} sent{run.digestFailed?` · ${run.digestFailed} failed`:""}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>
  </AfendaPageFrame>;
}

function Aging({label,value}:{label:string;value:number}){return <div className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div></div>;}

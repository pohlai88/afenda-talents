"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { inBucket, managementSummary, type ControlTowerBucket, type ReminderDeliveryRow } from "@/lib/corporate-admin/control-tower";
import type { WorkItemRow } from "@/lib/corporate-admin/work-items";
import { CorporateStatusBadge, corporateStatusLabel } from "@/components/corporate/status";

type Props = {
  items: WorkItemRow[];
  reminders: ReminderDeliveryRow[];
  currentUserId: string;
  isAdmin: boolean;
  today: string;
};

const buckets: Array<{key:ControlTowerBucket;label:string}> = [
  {key:"TODAY",label:"Today"},
  {key:"THIS_WEEK",label:"This week"},
  {key:"ESCALATED",label:"Escalated"},
  {key:"AWAITING_ME",label:"Awaiting me"},
  {key:"UNASSIGNED",label:"Unassigned"},
];

export function ControlTowerWorkspace({items,reminders,currentUserId,isAdmin,today}:Props) {
  const [bucket,setBucket]=useState<ControlTowerBucket>("TODAY");
  const [busy,setBusy]=useState<string|null>(null);
  const summary=useMemo(()=>managementSummary(items,today),[items,today]);
  const visible=useMemo(()=>items.filter(item=>inBucket(item,bucket,today,currentUserId)),[items,bucket,today,currentUserId]);

  async function post(body:unknown,key:string){
    setBusy(key);
    try{
      const response=await fetch("/api/admin/corporate/control-tower/reminders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Reminder action failed");
      if(data.status==="BLOCKED")toast.error("Email transport is not configured. The blocked attempt was recorded.");
      else if(data.status==="FAILED")toast.error("Email delivery failed. The failed attempt was recorded.");
      else if(data.status==="SKIPPED")toast.info("A matching reminder already exists for today.");
      else if(body && typeof body==="object" && "action" in body && body.action==="GENERATE_IN_APP")toast.success(`Created ${data.created??0} in-app reminder(s); ${data.skipped??0} already existed.`);
      else toast.success("Reminder delivered and recorded.");
      window.location.reload();
    }catch(error){toast.error(error instanceof Error?error.message:"Reminder action failed");}
    finally{setBusy(null);}
  }

  const metrics=[
    ["Open",summary.open],
    ["Due today",summary.dueToday],
    ["Due this week",summary.dueThisWeek],
    ["Overdue",summary.overdue],
    ["Escalated",summary.escalated],
    ["Unassigned",summary.unassigned],
  ] as const;

  return <div className="flex flex-col gap-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {metrics.map(([label,value])=><Card key={label}><CardHeader className="gap-1 pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-3xl tabular-nums">{value}</CardTitle></CardHeader></Card>)}
    </div>

    <Card>
      <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
        <div><CardTitle>Administrative command queue</CardTitle><CardDescription>Focus on what needs attention now. Reminder delivery never changes task status.</CardDescription></div>
        {isAdmin?<Button disabled={busy!==null} onClick={()=>void post({action:"GENERATE_IN_APP"},"generate")}>{busy==="generate"?"Generating…":"Generate in-app reminders"}</Button>:null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Control tower view">
          {buckets.map(item=><Button key={item.key} size="sm" variant={bucket===item.key?"default":"outline"} role="tab" aria-selected={bucket===item.key} onClick={()=>setBucket(item.key)}>{item.label}</Button>)}
        </div>
        {visible.length===0?<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No unresolved work in this view.</div>:<div className="flex flex-col divide-y rounded-lg border">
          {visible.map(item=><div key={item.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.title}</span><CorporateStatusBadge status={item.priority} />{item.escalationLevel>0?<Badge variant="destructive">Escalation L{item.escalationLevel}</Badge>:null}<CorporateStatusBadge status={item.status} /></div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>Owner: {item.ownerName??"Unassigned"}</span><span>Due: {item.dueDate??"No due date"}</span><span>Source: {corporateStatusLabel(item.sourceType)}</span></div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {item.sourceHref?<Button size="sm" variant="outline" nativeButton={false} render={<Link href={item.sourceHref}/>}>Open source</Button>:null}
              <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/admin/corporate/work-items"/>}>Work queue</Button>
              {isAdmin&&item.ownerId?<Button size="sm" variant="outline" disabled={busy!==null} onClick={()=>void post({action:"SEND",workItemId:item.id,channel:"IN_APP"},`inapp:${item.id}`)}>Remind in-app</Button>:null}
              {isAdmin&&item.ownerId?<Button size="sm" disabled={busy!==null} onClick={()=>void post({action:"SEND",workItemId:item.id,channel:"EMAIL"},`email:${item.id}`)}>Send email</Button>:null}
            </div>
          </div>)}
        </div>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Reminder delivery evidence</CardTitle><CardDescription>Recent reminder attempts. Email failures/blocks remain visible instead of disappearing behind transient UI messages.</CardDescription></CardHeader>
      <CardContent>{reminders.length===0?<p className="text-sm text-muted-foreground">No reminders have been recorded yet.</p>:<div className="flex flex-col divide-y rounded-lg border">{reminders.slice(0,50).map(row=><div key={row.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{row.subject}</span><span className="inline-flex items-center gap-1.5"><span className="text-xs text-muted-foreground">{corporateStatusLabel(row.channel)}</span><CorporateStatusBadge status={row.status} /></span></div><div className="mt-1 text-xs text-muted-foreground">Recipient: {row.recipientName??"Unavailable"} · {new Date(row.createdAt).toLocaleString()}{row.failureCode?` · ${row.failureCode}`:""}</div></div><Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/admin/corporate/work-items"/>}>Open work</Button></div>)}</div>}</CardContent>
    </Card>
  </div>;
}

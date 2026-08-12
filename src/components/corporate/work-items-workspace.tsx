"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { workItemAttention, type WorkItemPriority, type WorkItemRow, type WorkItemStatus } from "@/lib/corporate-admin/work-items";

type UserOption = { id:string; name:string };
type Props = { workItems:WorkItemRow[]; users:UserOption[]; currentUserId:string; isAdmin:boolean; today:string };

export function WorkItemsWorkspace({workItems,users,currentUserId,isAdmin,today}:Props) {
  const router=useRouter();
  const [query,setQuery]=useState("");
  const [view,setView]=useState<"OPEN"|"MINE"|"UNASSIGNED"|"OVERDUE"|"ALL">("OPEN");
  const [busy,setBusy]=useState<string|null>(null);
  const filtered=useMemo(()=>workItems.filter(item=>{
    const q=query.trim().toLowerCase();
    if(q&&!`${item.title} ${item.sourceType} ${item.ownerName??""}`.toLowerCase().includes(q))return false;
    if(view==="OPEN"&&["RESOLVED","CANCELLED"].includes(item.status))return false;
    if(view==="MINE"&&(item.ownerId!==currentUserId||["RESOLVED","CANCELLED"].includes(item.status)))return false;
    if(view==="UNASSIGNED"&&(item.ownerId||["RESOLVED","CANCELLED"].includes(item.status)))return false;
    if(view==="OVERDUE"&&workItemAttention(item,today)!=="OVERDUE")return false;
    return true;
  }),[workItems,query,view,currentUserId,today]);
  const open=workItems.filter(i=>!["RESOLVED","CANCELLED"].includes(i.status)).length;
  const unassigned=workItems.filter(i=>!i.ownerId&&!["RESOLVED","CANCELLED"].includes(i.status)).length;
  const overdue=workItems.filter(i=>workItemAttention(i,today)==="OVERDUE").length;
  const escalated=workItems.filter(i=>i.escalationLevel>0&&!["RESOLVED","CANCELLED"].includes(i.status)).length;

  async function patch(id:string,body:Record<string,unknown>){setBusy(id);try{const r=await fetch(`/api/admin/corporate/work-items/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(typeof data.error==="string"?data.error:"Could not update work item");toast.success("Work item updated");router.refresh();}catch(error){toast.error(error instanceof Error?error.message:"Could not update work item");}finally{setBusy(null);}}
  async function sync(){setBusy("sync");try{const r=await fetch("/api/admin/corporate/work-items/sync",{method:"POST"});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(typeof data.error==="string"?data.error:"Could not sync work");toast.success(`Operational work synced: ${data.created??0} created, ${data.escalated??0} escalation changes`);router.refresh();}catch(error){toast.error(error instanceof Error?error.message:"Could not sync work");}finally{setBusy(null);}}

  return <div className="flex flex-col gap-5">
    <div className="grid gap-3 sm:grid-cols-4">
      {[['Open',open],['Unassigned',unassigned],['Overdue',overdue],['Escalated',escalated]].map(([label,value])=><Card key={String(label)}><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-3xl tabular-nums">{value}</CardTitle></CardHeader></Card>)}
    </div>
    <Card><CardHeader><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle>Administrative work queue</CardTitle><CardDescription>Accountable work derived from administrative records and deterministic operational signals.</CardDescription></div>{isAdmin?<Button onClick={sync} disabled={busy==="sync"}>{busy==="sync"?"Syncing…":"Sync operational work"}</Button>:null}</div></CardHeader><CardContent className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center"><Input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search work items, source or owner" aria-label="Search administrative work items"/><div className="flex flex-wrap gap-2">{(["OPEN","MINE","UNASSIGNED","OVERDUE","ALL"] as const).map(value=><Button key={value} size="sm" variant={view===value?"default":"outline"} onClick={()=>setView(value)}>{value.replace('_',' ')}</Button>)}</div></div>
      <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Work</TableHead><TableHead>Owner</TableHead><TableHead>Due</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Escalation</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{filtered.length===0?<TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No work items in this view.</TableCell></TableRow>:filtered.map(item=>{
        const attention=workItemAttention(item,today);return <TableRow key={item.id}><TableCell><div className="font-medium">{item.title}</div><div className="text-xs text-muted-foreground">{item.sourceType}{item.sourceHref?<> · <Link className="underline underline-offset-2" href={item.sourceHref}>Open source</Link></>:null}</div></TableCell><TableCell>{isAdmin?<select className="h-9 max-w-48 rounded-md border bg-background px-2 text-sm" aria-label={`Owner for ${item.title}`} value={item.ownerId??""} disabled={busy===item.id} onChange={e=>void patch(item.id,{ownerId:e.target.value||null})}><option value="">Unassigned</option>{users.map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select>:item.ownerName??"Unassigned"}</TableCell><TableCell className="whitespace-nowrap"><div>{item.dueDate??"—"}</div>{attention==="OVERDUE"?<Badge variant="destructive">Overdue</Badge>:attention==="DUE_SOON"?<Badge variant="secondary">Due soon</Badge>:null}</TableCell><TableCell>{isAdmin?<select className="h-9 rounded-md border bg-background px-2 text-sm" aria-label={`Priority for ${item.title}`} value={item.priority} disabled={busy===item.id} onChange={e=>void patch(item.id,{priority:e.target.value as WorkItemPriority})}>{(["LOW","NORMAL","HIGH","CRITICAL"] as const).map(p=><option key={p}>{p}</option>)}</select>:item.priority}</TableCell><TableCell><Badge variant={item.status==="RESOLVED"?"outline":item.status==="OPEN"?"secondary":"default"}>{item.status}</Badge></TableCell><TableCell>{item.escalationLevel>0?<Badge variant={item.escalationLevel>=3?"destructive":"secondary"}>L{item.escalationLevel}</Badge>:"—"}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2">{isAdmin&&item.status==="OPEN"?<Button size="sm" variant="outline" disabled={busy===item.id} onClick={()=>void patch(item.id,{status:"ACKNOWLEDGED" satisfies WorkItemStatus})}>Acknowledge</Button>:null}{isAdmin&&["OPEN","ACKNOWLEDGED"].includes(item.status)?<Button size="sm" variant="outline" disabled={busy===item.id} onClick={()=>void patch(item.id,{status:"IN_PROGRESS" satisfies WorkItemStatus})}>Start</Button>:null}{isAdmin&&!['RESOLVED','CANCELLED'].includes(item.status)?<Button size="sm" disabled={busy===item.id} onClick={()=>void patch(item.id,{status:"RESOLVED" satisfies WorkItemStatus})}>Resolve</Button>:null}</div></TableCell></TableRow>})}</TableBody></Table></div>
    </CardContent></Card>
  </div>;
}

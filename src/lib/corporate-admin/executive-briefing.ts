import type { WorkItemRow } from "@/lib/corporate-admin/work-items";

export type OwnerWorkload = { ownerId:string|null; ownerName:string; open:number; overdue:number; escalated:number; resolved30d:number };
export type ExecutiveBriefing = {
  open:number; overdue:number; escalated:number; unassigned:number; due7d:number;
  resolved30d:number; created30d:number; closureRate30d:number;
  medianResolutionDays30d:number|null;
  aging:{ under3:number; days3to6:number; days7to13:number; days14plus:number };
  owners:OwnerWorkload[];
};

function dayDiff(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function buildExecutiveBriefing(items: WorkItemRow[], today: string): ExecutiveBriefing {
  const unresolved = items.filter(i=>i.status!=="RESOLVED"&&i.status!=="CANCELLED");
  const thirtyDaysAgo = new Date(`${today}T00:00:00Z`); thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate()-30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0,10);
  const resolved30 = items.filter(i=>i.resolvedAt && i.resolvedAt.toISOString().slice(0,10)>=cutoff);
  const created30 = items.filter(i=>i.createdAt.toISOString().slice(0,10)>=cutoff);
  const created30Resolved = created30.filter(i=>i.status==="RESOLVED");
  const durations = resolved30.map(i=>Math.max(0, Math.floor(((i.resolvedAt as Date).getTime()-i.createdAt.getTime())/86_400_000))).sort((a,b)=>a-b);
  const median = durations.length===0?null:durations.length%2?durations[(durations.length-1)/2]:Math.round((durations[durations.length/2-1]+durations[durations.length/2])/2);
  const aging={under3:0,days3to6:0,days7to13:0,days14plus:0};
  for(const item of unresolved){const age=Math.max(0,dayDiff(item.createdAt.toISOString().slice(0,10),today));if(age<3)aging.under3++;else if(age<7)aging.days3to6++;else if(age<14)aging.days7to13++;else aging.days14plus++;}
  const byOwner=new Map<string,OwnerWorkload>();
  for(const item of items){const key=item.ownerId??"__unassigned__";const row=byOwner.get(key)??{ownerId:item.ownerId,ownerName:item.ownerName??"Unassigned",open:0,overdue:0,escalated:0,resolved30d:0};if(item.status!=="RESOLVED"&&item.status!=="CANCELLED"){row.open++;if(item.dueDate&&item.dueDate<today)row.overdue++;if(item.escalationLevel>0)row.escalated++;}if(item.resolvedAt&&item.resolvedAt.toISOString().slice(0,10)>=cutoff)row.resolved30d++;byOwner.set(key,row);}
  const horizon=new Date(`${today}T00:00:00Z`);horizon.setUTCDate(horizon.getUTCDate()+7);const horizonStr=horizon.toISOString().slice(0,10);
  return {
    open:unresolved.length,
    overdue:unresolved.filter(i=>i.dueDate&&i.dueDate<today).length,
    escalated:unresolved.filter(i=>i.escalationLevel>0).length,
    unassigned:unresolved.filter(i=>!i.ownerId).length,
    due7d:unresolved.filter(i=>i.dueDate&&i.dueDate>=today&&i.dueDate<=horizonStr).length,
    resolved30d:resolved30.length,
    created30d:created30.length,
    closureRate30d:created30.length?Math.round((created30Resolved.length/created30.length)*100):0,
    medianResolutionDays30d:median,
    aging,
    owners:[...byOwner.values()].sort((a,b)=>b.overdue-a.overdue||b.open-a.open||a.ownerName.localeCompare(b.ownerName)),
  };
}

export function renderExecutiveDigest(briefing: ExecutiveBriefing, period:"DAILY"|"WEEKLY", today:string): {subject:string;body:string} {
  const top=briefing.owners.slice(0,5).map(o=>`- ${o.ownerName}: ${o.open} open, ${o.overdue} overdue, ${o.escalated} escalated`).join("\n")||"- No active owner workload.";
  const subject=`Afenda ${period === "DAILY" ? "Daily" : "Weekly"} Administration Brief · ${today}`;
  const body=[
    `${period === "DAILY" ? "Daily" : "Weekly"} Corporate Administration briefing for ${today}`,
    "",
    `Open: ${briefing.open}`,
    `Overdue: ${briefing.overdue}`,
    `Escalated: ${briefing.escalated}`,
    `Unassigned: ${briefing.unassigned}`,
    `Due within 7 days: ${briefing.due7d}`,
    "",
    `Created in last 30 days: ${briefing.created30d}`,
    `Resolved in last 30 days: ${briefing.resolved30d}`,
    `30-day created cohort already resolved: ${briefing.closureRate30d}%`,
    `Median resolution time: ${briefing.medianResolutionDays30d ?? "n/a"} days`,
    "",
    `Aging: <3d ${briefing.aging.under3} · 3-6d ${briefing.aging.days3to6} · 7-13d ${briefing.aging.days7to13} · 14+d ${briefing.aging.days14plus}`,
    "",
    "Owner workload exceptions:",top,
    "",
    "Open Afenda Corporate Control Tower for authoritative task detail."
  ].join("\n");
  return {subject,body};
}
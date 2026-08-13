import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { reminderCopy, reminderEligible } from "@/lib/corporate-admin/control-tower";
import { buildExecutiveBriefing, renderExecutiveDigest } from "@/lib/corporate-admin/executive-briefing";
import { listWorkItems, refreshEscalations } from "@/lib/corporate-admin/work-items-server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const SYSTEM_ACTOR = "system:corporate-automation";
export type AutomationJobType = "DAILY" | "WEEKLY";
export type AutomationRunRow = {
  id:string; runKey:string; jobType:AutomationJobType; status:"RUNNING"|"COMPLETED"|"PARTIAL"|"FAILED"|"SKIPPED";
  scheduledFor:Date; workItemsCreated:number; escalationsChanged:number; remindersCreated:number;
  digestRecipients:number; digestSent:number; digestFailed:number; failureCode:string|null; startedAt:Date; completedAt:Date|null;
};

function dateOnly(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Kuala_Lumpur", year:"numeric", month:"2-digit", day:"2-digit" }).format(date);
}

async function reserveRun(jobType:AutomationJobType, today:string): Promise<{id:string;created:boolean}> {
  const id=randomUUID(); const runKey=`${jobType.toLowerCase()}:${today}`;
  const rows=await db.$queryRaw<Array<{id:string}>>(Prisma.sql`
    INSERT INTO "AdministrativeAutomationRun" ("id","runKey","jobType","status","scheduledFor")
    VALUES (${id},${runKey},${jobType},'RUNNING',${new Date()})
    ON CONFLICT ("runKey") DO NOTHING RETURNING "id"
  `);
  return rows[0]?{id:rows[0].id,created:true}:{id,created:false};
}

async function materializeOperationalWorkSystem(today:string):Promise<number>{
  const horizon=new Date(`${today}T00:00:00Z`);horizon.setUTCDate(horizon.getUTCDate()+7);
  const [dues,lines]=await Promise.all([
    db.obligationDueItem.findMany({where:{status:"OPEN",dueDate:{lte:horizon}},select:{id:true,dueDate:true,periodLabel:true,obligation:{select:{id:true,code:true,title:true,ownerId:true}},line:{select:{code:true,name:true}}},take:200}),
    db.administrativeObligationLine.findMany({where:{isActive:true,recurring:true,nextDueDate:null,obligation:{status:"ACTIVE"}},select:{id:true,code:true,name:true,obligation:{select:{id:true,code:true,title:true,ownerId:true}}},take:100}),
  ]);
  let created=0;
  for(const due of dues){const dueDate=due.dueDate.toISOString().slice(0,10);const id=randomUUID();const count=await db.$executeRaw(Prisma.sql`
    INSERT INTO "AdministrativeWorkItem" ("id","title","description","priority","ownerId","sourceType","sourceId","sourceKey","sourceHref","dueDate","escalateAfter","createdById")
    VALUES (${id},${`${due.obligation.code} · ${due.line.code} due ${dueDate}`},${`${due.obligation.title} / ${due.line.name} / ${due.periodLabel}`},${dueDate<today?"HIGH":"NORMAL"},${due.obligation.ownerId},'DUE_ITEM',${due.id},${`due-item:${due.id}`},${`/admin/corporate/obligations/${due.obligation.id}`},${due.dueDate},${due.dueDate},NULL)
    ON CONFLICT ("sourceKey") WHERE "sourceKey" IS NOT NULL DO NOTHING
  `);if(count){created++;await audit(SYSTEM_ACTOR,"corporate.work_item.created",id,{sourceType:"DUE_ITEM",sourceId:due.id,generated:true});}}
  for(const line of lines){const id=randomUUID();const count=await db.$executeRaw(Prisma.sql`
    INSERT INTO "AdministrativeWorkItem" ("id","title","description","priority","ownerId","sourceType","sourceId","sourceKey","sourceHref","dueDate","escalateAfter","createdById")
    VALUES (${id},${`${line.obligation.code} · ${line.code} needs next due date`},${`${line.obligation.title} / ${line.name} is active and recurring but has no next-due pointer.`},'HIGH',${line.obligation.ownerId},'LINE',${line.id},${`line-next-due:${line.id}`},${`/admin/corporate/obligations/${line.obligation.id}/lines`},${new Date(`${today}T00:00:00Z`)},${new Date(`${today}T00:00:00Z`)},NULL)
    ON CONFLICT ("sourceKey") WHERE "sourceKey" IS NOT NULL DO NOTHING
  `);if(count){created++;await audit(SYSTEM_ACTOR,"corporate.work_item.created",id,{sourceType:"LINE",sourceId:line.id,generated:true});}}
  return created;
}

async function generateScheduledInAppReminders(today:string):Promise<number>{
  const items=await listWorkItems();let created=0;
  for(const raw of items){const escalation=raw.status==="RESOLVED"||raw.status==="CANCELLED"||!raw.dueDate?0:raw.dueDate<today?raw.escalationLevel||1:0;const item={...raw,escalationLevel:escalation};if(!reminderEligible(item,today))continue;const copy=reminderCopy(item,today);const deliveryKey=`inapp:${item.id}:${item.ownerId}:${today}:L${escalation}`;const id=randomUUID();const rows=await db.$queryRaw<Array<{id:string}>>(Prisma.sql`
    INSERT INTO "AdministrativeReminderDelivery" ("id","workItemId","recipientUserId","channel","status","deliveryKey","subject","body","sentAt","createdById")
    VALUES (${id},${item.id},${item.ownerId},'IN_APP','SENT',${deliveryKey},${copy.subject},${copy.body},${new Date()},NULL)
    ON CONFLICT ("deliveryKey") DO NOTHING RETURNING "id"
  `);if(rows[0]){created++;await audit(SYSTEM_ACTOR,"corporate.reminder.sent",item.id,{channel:"IN_APP",recipientUserId:item.ownerId??undefined,deliveryId:rows[0].id,scheduled:true});}}
  return created;
}

async function sendExecutiveDigest(jobType:AutomationJobType,today:string):Promise<{recipients:number;sent:number;failed:number;evidence:string[]}>{
  const admins=await db.user.findMany({where:{role:"ADMIN"},select:{id:true,email:true}});
  const briefing=buildExecutiveBriefing(await listWorkItems(),today);const copy=renderExecutiveDigest(briefing,jobType,today);const evidence:string[]=[];
  if(!env.RESEND_API_KEY||!env.MAIL_FROM)return{recipients:admins.length,sent:0,failed:admins.length,evidence:["EMAIL_TRANSPORT_NOT_CONFIGURED"]};
  let sent=0,failed=0;
  for(const admin of admins){try{const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.MAIL_FROM,to:[admin.email],subject:copy.subject,text:copy.body})});if(!response.ok){failed++;evidence.push(`HTTP_${response.status}`);continue;}const payload=await response.json().catch(()=>({})) as {id?:string};sent++;if(payload.id)evidence.push(payload.id);}catch{failed++;evidence.push("TRANSPORT_ERROR");}}
  return{recipients:admins.length,sent,failed,evidence};
}

export async function runCorporateAutomation(jobType:AutomationJobType, today=dateOnly()):Promise<{status:"COMPLETED"|"PARTIAL"|"SKIPPED";runId?:string}> {
  const reservation=await reserveRun(jobType,today);if(!reservation.created)return{status:"SKIPPED"};
  try{
    const workItemsCreated=await materializeOperationalWorkSystem(today);
    const escalationsChanged=await refreshEscalations(today,SYSTEM_ACTOR);
    const remindersCreated=await generateScheduledInAppReminders(today);
    const digest=await sendExecutiveDigest(jobType,today);
    const status=digest.failed>0?"PARTIAL":"COMPLETED";
    await db.$executeRaw(Prisma.sql`UPDATE "AdministrativeAutomationRun" SET "status"=${status},"workItemsCreated"=${workItemsCreated},"escalationsChanged"=${escalationsChanged},"remindersCreated"=${remindersCreated},"digestRecipients"=${digest.recipients},"digestSent"=${digest.sent},"digestFailed"=${digest.failed},"providerEvidence"=${JSON.stringify(digest.evidence)}::jsonb,"failureCode"=${digest.failed?"DIGEST_DELIVERY_INCOMPLETE":null},"completedAt"=${new Date()} WHERE "id"=${reservation.id}`);
    return{status,runId:reservation.id};
  }catch(error){await db.$executeRaw(Prisma.sql`UPDATE "AdministrativeAutomationRun" SET "status"='FAILED',"failureCode"='AUTOMATION_RUN_FAILED',"completedAt"=${new Date()} WHERE "id"=${reservation.id}`);throw error;}
}

export async function listAutomationRuns(limit=30):Promise<AutomationRunRow[]>{return db.$queryRaw<AutomationRunRow[]>(Prisma.sql`SELECT "id","runKey","jobType","status","scheduledFor","workItemsCreated","escalationsChanged","remindersCreated","digestRecipients","digestSent","digestFailed","failureCode","startedAt","completedAt" FROM "AdministrativeAutomationRun" ORDER BY "scheduledFor" DESC LIMIT ${Math.max(1,Math.min(limit,100))}`);}
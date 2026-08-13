import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { cleanOptionalString, formatDateOnly, parseDateOnly } from "@/lib/corporate-admin/domain";
import { createObligationLineSchema } from "@/lib/corporate-admin/obligation-lines";
import type { CorporateImportPayload, CorporateImportPreviewRow, CorporateImportRow } from "@/lib/corporate-admin/safe-import";
import { db } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof db;
export type CorporateImportPlan = { rows: CorporateImportPreviewRow[]; previewHash: string; summary: { create: number; update: number; noChange: number; error: number; siteLinks: number; clears: number } };
const lineFields = ["lineName","lineType","expectedAmount","currency","recurring","recurrenceInterval","recurrenceUnit","firstDueDate","nextDueDate","invoiceRequired","paymentTermsDays","startDate","endDate","notes"] as const;
type ImportField = (typeof lineFields)[number];
function date(value: Date | null): string | null { return value ? formatDateOnly(value) : null; }
function decimal(value: { toString(): string } | number | null): number | null { return value == null ? null : Number(value.toString()); }
function comparable(value: unknown): string | number | boolean | null { if (value == null) return null; if (["string","number","boolean"].includes(typeof value)) return value as string|number|boolean; return String(value); }
function currentLineRecord(line: { name:string; lineType:string; expectedAmount:{toString():string}|null; currency:string; recurring:boolean; recurrenceInterval:number|null; recurrenceUnit:"DAY"|"WEEK"|"MONTH"|"YEAR"|null; firstDueDate:Date|null; nextDueDate:Date|null; invoiceRequired:boolean; paymentTermsDays:number|null; startDate:Date|null; endDate:Date|null; notes:string|null }) {
  return { lineName:line.name,lineType:line.lineType,expectedAmount:decimal(line.expectedAmount),currency:line.currency,recurring:line.recurring,recurrenceInterval:line.recurrenceInterval,recurrenceUnit:line.recurrenceUnit,firstDueDate:date(line.firstDueDate),nextDueDate:date(line.nextDueDate),invoiceRequired:line.invoiceRequired,paymentTermsDays:line.paymentTermsDays,startDate:date(line.startDate),endDate:date(line.endDate),notes:line.notes };
}
function mergedCreateCandidate(row: CorporateImportRow, current?: ReturnType<typeof currentLineRecord>) {
  const cleared = new Set(row.clearFields);
  const pick = <T>(field: ImportField, incoming: T | undefined, existing: T | null | undefined, fallback: T | null = null): T | null => cleared.has(field as never) ? null : incoming ?? existing ?? fallback;
  const firstDueDate = pick("firstDueDate", row.firstDueDate, current?.firstDueDate);
  const nextDueDate = cleared.has("nextDueDate") ? null : row.nextDueDate ?? current?.nextDueDate ?? (current ? null : firstDueDate);
  return {
    code: row.lineCode.toUpperCase(), name: row.lineName ?? current?.lineName, lineType: (row.lineType ?? current?.lineType)?.toUpperCase(),
    expectedAmount: pick("expectedAmount", row.expectedAmount, current?.expectedAmount), currency: row.currency ?? current?.currency,
    recurring: row.recurring ?? current?.recurring ?? false, recurrenceInterval: pick("recurrenceInterval", row.recurrenceInterval, current?.recurrenceInterval),
    recurrenceUnit: pick("recurrenceUnit", row.recurrenceUnit, current?.recurrenceUnit), firstDueDate, nextDueDate,
    invoiceRequired: row.invoiceRequired ?? current?.invoiceRequired ?? false, paymentTermsDays: pick("paymentTermsDays", row.paymentTermsDays, current?.paymentTermsDays),
    startDate: pick("startDate", row.startDate, current?.startDate), endDate: pick("endDate", row.endDate, current?.endDate), notes: pick("notes", row.notes, current?.notes),
  };
}
export async function buildCorporateImportPlan(payload: CorporateImportPayload, client: DbClient = db): Promise<CorporateImportPlan> {
  const obligationCodes=[...new Set(payload.rows.map(r=>r.obligationCode.toUpperCase()))]; const siteCodes=[...new Set(payload.rows.flatMap(r=>r.siteCodes.map(c=>c.toUpperCase())))];
  const [obligations,sites]=await Promise.all([
    client.administrativeObligation.findMany({where:{code:{in:obligationCodes}},select:{id:true,code:true,status:true,lines:{select:{id:true,code:true,name:true,lineType:true,expectedAmount:true,currency:true,recurring:true,recurrenceInterval:true,recurrenceUnit:true,firstDueDate:true,nextDueDate:true,invoiceRequired:true,paymentTermsDays:true,startDate:true,endDate:true,notes:true}},sites:{select:{site:{select:{code:true}}}}}}),
    siteCodes.length?client.administrativeSite.findMany({where:{code:{in:siteCodes}},select:{id:true,code:true,isActive:true}}):Promise.resolve([]),
  ]);
  const obligationByCode=new Map(obligations.map(i=>[i.code.toUpperCase(),i])); const siteByCode=new Map(sites.map(i=>[i.code.toUpperCase(),i])); const seen=new Set<string>(); const previewRows:CorporateImportPreviewRow[]=[];
  for(const row of payload.rows){
    const obligationCode=row.obligationCode.toUpperCase(), lineCode=row.lineCode.toUpperCase(), key=`${obligationCode}::${lineCode}`, errors:string[]=[]; const obligation=obligationByCode.get(obligationCode);
    if(seen.has(key)) errors.push("Duplicate obligation_code + line_code in this import"); seen.add(key); if(!obligation) errors.push(`Obligation ${obligationCode} was not found`);
    const line=obligation?.lines.find(i=>i.code.toUpperCase()===lineCode); if(!line&&obligation&&(obligation.status==="ENDED"||obligation.status==="CANCELLED")) errors.push("Closed obligations cannot receive new agreement lines");
    row.siteCodes.forEach(code=>{const site=siteByCode.get(code.toUpperCase()); if(!site) errors.push(`Site ${code.toUpperCase()} was not found`); else if(!site.isActive) errors.push(`Site ${site.code} is inactive`);});
    const current=line?currentLineRecord(line):undefined, merged=mergedCreateCandidate(row,current), validation=createObligationLineSchema.safeParse(merged); if(!validation.success) errors.push(...validation.error.issues.map(i=>`${i.path.join(".")||"line"}: ${i.message}`));
    const changes:CorporateImportPreviewRow["changes"]=[]; const cleared=new Set(row.clearFields);
    if(line&&current){for(const field of lineFields){if(cleared.has(field as never)){const before=comparable(current[field]); if(before!==null) changes.push({field,before,after:null,destructive:true}); continue;} const incoming=row[field as ImportField]; if(incoming===undefined) continue; const before=comparable(current[field]),after=comparable(incoming); if(before!==after) changes.push({field,before,after});}}
    else if(!line&&validation.success){for(const field of lineFields){const value=comparable((merged as Record<string,unknown>)[field]); if(value!==null) changes.push({field,before:null,after:value});}}
    const existingSiteCodes=new Set(obligation?.sites.map(l=>l.site.code.toUpperCase())??[]); for(const code of row.siteCodes.map(i=>i.toUpperCase())) if(!existingSiteCodes.has(code)&&!errors.some(e=>e.includes(`Site ${code}`))) changes.push({field:`site:${code}`,before:null,after:code});
    previewRows.push({rowNumber:row.rowNumber,obligationCode,lineCode,action:errors.length?"ERROR":line?(changes.length?"UPDATE":"NO_CHANGE"):"CREATE",lineId:line?.id??null,obligationId:obligation?.id??null,changes,siteCodes:row.siteCodes.map(c=>c.toUpperCase()),errors});
  }
  const canonical=previewRows.map(r=>({rowNumber:r.rowNumber,obligationCode:r.obligationCode,lineCode:r.lineCode,action:r.action,lineId:r.lineId,obligationId:r.obligationId,changes:r.changes,siteCodes:r.siteCodes,errors:r.errors}));
  const previewHash=createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  const summary={create:previewRows.filter(r=>r.action==="CREATE").length,update:previewRows.filter(r=>r.action==="UPDATE").length,noChange:previewRows.filter(r=>r.action==="NO_CHANGE").length,error:previewRows.filter(r=>r.action==="ERROR").length,siteLinks:previewRows.reduce((n,r)=>n+r.changes.filter(c=>c.field.startsWith("site:")).length,0),clears:previewRows.reduce((n,r)=>n+r.changes.filter(c=>c.destructive).length,0)};
  return {rows:previewRows,previewHash,summary};
}
export async function applyCorporateImport(payload: CorporateImportPayload, actorId:string, expectedPreviewHash:string){
  return db.$transaction(async tx=>{
    const plan=await buildCorporateImportPlan(payload,tx); if(plan.previewHash!==expectedPreviewHash) throw new Error("Import preview is stale. Preview again before committing."); if(plan.summary.error>0) throw new Error("Import contains validation errors. Resolve them before committing.");
    let created=0,updated=0; const linked=new Set<string>();
    for(const row of payload.rows){const preview=plan.rows.find(i=>i.rowNumber===row.rowNumber)!;
      if(preview.action==="CREATE"){const parsed=createObligationLineSchema.parse(mergedCreateCandidate(row)); const line=await tx.administrativeObligationLine.create({data:{obligationId:preview.obligationId!,code:parsed.code.toUpperCase(),name:parsed.name,lineType:parsed.lineType.toUpperCase(),expectedAmount:parsed.expectedAmount??null,currency:parsed.currency,recurring:parsed.recurring,recurrenceInterval:parsed.recurring?parsed.recurrenceInterval:null,recurrenceUnit:parsed.recurring?parsed.recurrenceUnit:null,firstDueDate:parsed.firstDueDate?parseDateOnly(parsed.firstDueDate):null,nextDueDate:parsed.nextDueDate?parseDateOnly(parsed.nextDueDate):null,invoiceRequired:parsed.invoiceRequired,paymentTermsDays:parsed.paymentTermsDays??null,startDate:parsed.startDate?parseDateOnly(parsed.startDate):null,endDate:parsed.endDate?parseDateOnly(parsed.endDate):null,notes:cleanOptionalString(parsed.notes)}}); await audit(actorId,"corporate.obligation.line.created",line.id,{obligationId:preview.obligationId!,source:"safe_import"},tx); created++;}
      else if(preview.action==="UPDATE"&&preview.lineId){const obligation=await tx.administrativeObligation.findUnique({where:{id:preview.obligationId!},select:{lines:{where:{id:preview.lineId},take:1}}}); const currentLine=obligation?.lines[0]; if(!currentLine) throw new Error(`Line ${preview.lineCode} changed during import`); const parsed=createObligationLineSchema.parse(mergedCreateCandidate(row,currentLineRecord(currentLine))); await tx.administrativeObligationLine.update({where:{id:preview.lineId},data:{name:parsed.name,lineType:parsed.lineType.toUpperCase(),expectedAmount:parsed.expectedAmount??null,currency:parsed.currency,recurring:parsed.recurring,recurrenceInterval:parsed.recurring?parsed.recurrenceInterval:null,recurrenceUnit:parsed.recurring?parsed.recurrenceUnit:null,firstDueDate:parsed.firstDueDate?parseDateOnly(parsed.firstDueDate):null,nextDueDate:parsed.nextDueDate?parseDateOnly(parsed.nextDueDate):null,invoiceRequired:parsed.invoiceRequired,paymentTermsDays:parsed.paymentTermsDays??null,startDate:parsed.startDate?parseDateOnly(parsed.startDate):null,endDate:parsed.endDate?parseDateOnly(parsed.endDate):null,notes:cleanOptionalString(parsed.notes)}}); await audit(actorId,"corporate.obligation.line.updated",preview.lineId,{obligationId:preview.obligationId!,source:"safe_import",clears:row.clearFields.length},tx); updated++;}
      for(const siteCode of row.siteCodes.map(c=>c.toUpperCase())){const linkKey=`${preview.obligationId}:${siteCode}`; if(linked.has(linkKey)) continue; const site=await tx.administrativeSite.findUnique({where:{code:siteCode},select:{id:true,isActive:true}}); if(!site?.isActive) throw new Error(`Site ${siteCode} changed during import`); await tx.administrativeObligationSite.upsert({where:{obligationId_siteId:{obligationId:preview.obligationId!,siteId:site.id}},update:{},create:{obligationId:preview.obligationId!,siteId:site.id}}); await audit(actorId,"corporate.obligation.site.linked",preview.obligationId!,{siteId:site.id,source:"safe_import"},tx); linked.add(linkKey);}
    }
    return {created,updated,siteLinks:linked.size,noChange:plan.summary.noChange,clears:plan.summary.clears};
  });
}

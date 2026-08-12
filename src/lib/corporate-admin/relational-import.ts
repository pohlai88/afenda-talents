import { z } from "zod";

export const relationalImportTargets = ["CONTACT", "SERVICE_COVERAGE", "OBLIGATION_SITE", "OBLIGATION_PARTY"] as const;
export type RelationalImportTarget = (typeof relationalImportTargets)[number];

export const RELATIONAL_IMPORT_HEADERS = {
  CONTACT: ["counterparty_code","contact_name","email","job_title","department","phone","mobile","role","is_primary","is_active","notes"],
  SERVICE_COVERAGE: ["site_code","counterparty_code","service_category","role_code","effective_from","effective_to","is_primary","is_active","service_level","emergency_contact","notes"],
  OBLIGATION_SITE: ["obligation_code","site_code","scope_role","notes"],
  OBLIGATION_PARTY: ["obligation_code","counterparty_code","role_code","is_primary","effective_from","effective_to","notes"],
} as const;

const aliases: Record<string,string> = {
  vendor_code:"counterparty_code", supplier_code:"counterparty_code", agreement_code:"obligation_code", contract_code:"obligation_code",
  site:"site_code", vendor:"counterparty_code", supplier:"counterparty_code", service:"service_category", service_type:"service_category",
  contact:"contact_name", contact_email:"email", title:"job_title", primary:"is_primary", active:"is_active",
  role:"role_code", effective_start:"effective_from", effective_end:"effective_to", remarks:"notes", remark:"notes",
};
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/,"Use YYYY-MM-DD").optional();
const boolValue = z.boolean().optional();
const common = { rowNumber:z.number().int().positive() };
export const contactImportRowSchema = z.object({ ...common, counterpartyCode:z.string().trim().min(2).max(40), contactName:z.string().trim().min(1).max(240), email:z.string().trim().email().max(320), jobTitle:z.string().trim().max(500).optional(), department:z.string().trim().max(500).optional(), phone:z.string().trim().max(500).optional(), mobile:z.string().trim().max(500).optional(), role:z.string().trim().max(500).optional(), isPrimary:boolValue, isActive:boolValue, notes:z.string().trim().max(10000).optional() }).strict();
export const coverageImportRowSchema = z.object({ ...common, siteCode:z.string().trim().min(2).max(50), counterpartyCode:z.string().trim().min(2).max(40), serviceCategory:z.string().trim().min(1).max(120), roleCode:z.string().trim().max(120).optional(), effectiveFrom:dateOnly, effectiveTo:dateOnly, isPrimary:boolValue, isActive:boolValue, serviceLevel:z.string().trim().max(500).optional(), emergencyContact:z.string().trim().max(500).optional(), notes:z.string().trim().max(10000).optional() }).superRefine((v,ctx)=>{if(v.effectiveFrom&&v.effectiveTo&&v.effectiveTo<v.effectiveFrom)ctx.addIssue({code:"custom",path:["effectiveTo"],message:"Effective-to date cannot be before effective-from date"});});
export const obligationSiteImportRowSchema = z.object({ ...common, obligationCode:z.string().trim().min(2).max(50), siteCode:z.string().trim().min(2).max(50), scopeRole:z.string().trim().max(120).optional(), notes:z.string().trim().max(10000).optional() }).strict();
export const obligationPartyImportRowSchema = z.object({ ...common, obligationCode:z.string().trim().min(2).max(50), counterpartyCode:z.string().trim().min(2).max(40), roleCode:z.string().trim().min(1).max(120), isPrimary:boolValue, effectiveFrom:dateOnly, effectiveTo:dateOnly, notes:z.string().trim().max(10000).optional() }).superRefine((v,ctx)=>{if(v.effectiveFrom&&v.effectiveTo&&v.effectiveTo<v.effectiveFrom)ctx.addIssue({code:"custom",path:["effectiveTo"],message:"Effective-to date cannot be before effective-from date"});});
export type RelationalImportRow = z.infer<typeof contactImportRowSchema>|z.infer<typeof coverageImportRowSchema>|z.infer<typeof obligationSiteImportRowSchema>|z.infer<typeof obligationPartyImportRowSchema>;
export const relationalImportPayloadSchema = z.object({ target:z.enum(relationalImportTargets), rows:z.array(z.record(z.string(),z.unknown())).min(1).max(200) }).strict();
export const relationalImportCommitSchema = relationalImportPayloadSchema.extend({ previewHash:z.string().regex(/^[0-9a-f]{64}$/) });

function splitLine(line:string,delimiter:string){const out:string[]=[];let current="",quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){current+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){out.push(current.trim());current="";}else current+=c;}out.push(current.trim());return out;}
function normalize(value:string){const key=value.trim().toLowerCase().replace(/[\s-]+/g,"_");return aliases[key]??key;}
function bool(value?:string){if(!value?.trim())return undefined;const v=value.trim().toLowerCase();if(["true","yes","y","1"].includes(v))return true;if(["false","no","n","0"].includes(v))return false;throw new Error(`Invalid boolean \"${value}\"`);}
function value(source:Record<string,string>,key:string){return source[key]||undefined;}

export function relationalImportTemplate(target:RelationalImportTarget){return RELATIONAL_IMPORT_HEADERS[target].join("\t");}
export function parseRelationalImportText(target:RelationalImportTarget,text:string):{rows:RelationalImportRow[];errors:string[]}{
  const normalized=text.replaceAll("\r\n","\n").replaceAll("\r","\n").trim();if(!normalized)return{rows:[],errors:["Paste or load a table first."]};const lines=normalized.split("\n").filter(l=>l.trim());if(lines.length<2)return{rows:[],errors:["Include a header row and at least one data row."]};
  const delimiter=lines[0].includes("\t")?"\t":",";const allowed=RELATIONAL_IMPORT_HEADERS[target] as readonly string[];const headers=splitLine(lines[0],delimiter).map(normalize);const unknown=headers.filter(h=>h&&!allowed.includes(h));if(unknown.length)return{rows:[],errors:[`Unknown column${unknown.length===1?"":"s"}: ${unknown.join(", ")}`]};const duplicates=[...new Set(headers.filter((h,i)=>h&&headers.indexOf(h)!==i))];if(duplicates.length)return{rows:[],errors:[`Multiple columns map to the same Afenda field: ${duplicates.join(", ")}`]};
  const rows:RelationalImportRow[]=[],errors:string[]=[];
  for(let index=1;index<lines.length;index++){const cells=splitLine(lines[index],delimiter);const s=Object.fromEntries(headers.map((h,i)=>[h,cells[i]??""]));try{let candidate:unknown;
    if(target==="CONTACT")candidate={rowNumber:index+1,counterpartyCode:s.counterparty_code,contactName:s.contact_name,email:s.email,jobTitle:value(s,"job_title"),department:value(s,"department"),phone:value(s,"phone"),mobile:value(s,"mobile"),role:value(s,"role"),isPrimary:bool(value(s,"is_primary")),isActive:bool(value(s,"is_active")),notes:value(s,"notes")};
    else if(target==="SERVICE_COVERAGE")candidate={rowNumber:index+1,siteCode:s.site_code,counterpartyCode:s.counterparty_code,serviceCategory:s.service_category,roleCode:value(s,"role_code"),effectiveFrom:value(s,"effective_from"),effectiveTo:value(s,"effective_to"),isPrimary:bool(value(s,"is_primary")),isActive:bool(value(s,"is_active")),serviceLevel:value(s,"service_level"),emergencyContact:value(s,"emergency_contact"),notes:value(s,"notes")};
    else if(target==="OBLIGATION_SITE")candidate={rowNumber:index+1,obligationCode:s.obligation_code,siteCode:s.site_code,scopeRole:value(s,"scope_role"),notes:value(s,"notes")};
    else candidate={rowNumber:index+1,obligationCode:s.obligation_code,counterpartyCode:s.counterparty_code,roleCode:s.role_code,isPrimary:bool(value(s,"is_primary")),effectiveFrom:value(s,"effective_from"),effectiveTo:value(s,"effective_to"),notes:value(s,"notes")};
    const schema=target==="CONTACT"?contactImportRowSchema:target==="SERVICE_COVERAGE"?coverageImportRowSchema:target==="OBLIGATION_SITE"?obligationSiteImportRowSchema:obligationPartyImportRowSchema;const parsed=schema.safeParse(candidate);if(!parsed.success)errors.push(`Row ${index+1}: ${parsed.error.issues.map(i=>i.message).join("; ")}`);else rows.push(parsed.data as RelationalImportRow);
  }catch(error){errors.push(`Row ${index+1}: ${error instanceof Error?error.message:"Could not parse row"}`);}}
  return{rows,errors};
}

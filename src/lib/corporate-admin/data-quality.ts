export type DataQualitySeverity = "ACTION" | "REVIEW";
export type DataQualityFinding = {
  id: string;
  severity: DataQualitySeverity;
  rule: string;
  title: string;
  detail: string;
  href: string;
  entityType: "SITE" | "COUNTERPARTY" | "OBLIGATION" | "LINE";
  entityCode: string;
};

export type QualitySnapshot = {
  sites: Array<{ id:string; code:string; name:string; type:string; isActive:boolean; organization:string|null; city:string|null; countryCode:string|null; timezone:string|null; coverage:Array<{id:string;counterpartyId:string;serviceCategory:string;roleCode:string|null;isPrimary:boolean;isActive:boolean}> }>;
  counterparties: Array<{ id:string; code:string; name:string; type:string; isActive:boolean; registrationNo:string|null; taxId:string|null; countryCode:string|null; defaultCurrency:string|null; paymentTermsDays:number|null; contacts:Array<{id:string;email:string|null;isPrimary:boolean;isActive:boolean}> }>;
  obligations: Array<{ id:string; code:string; title:string; category:string; organization:string; status:string; counterpartyId:string; contractRequired:boolean; contractReference:string|null; contractFileUrl:string|null; sites:Array<{siteId:string;isActive:boolean}>; parties:Array<{counterpartyId:string;roleCode:string;isPrimary:boolean;isActive:boolean}>; lines:Array<{id:string;code:string;name:string;recurring:boolean;nextDueDate:string|null;isActive:boolean}> }>;
};

export type CompletenessCheck = { label:string; complete:boolean };
export type CompletenessRecord = { entityType:"SITE"|"COUNTERPARTY"|"OBLIGATION"; entityCode:string; label:string; href:string; complete:number; total:number; percent:number; checks:CompletenessCheck[] };

function finding(input:Omit<DataQualityFinding,"id">):DataQualityFinding{return{id:`${input.rule}:${input.entityType}:${input.entityCode}`, ...input};}
function completeness(entityType:CompletenessRecord["entityType"],entityCode:string,label:string,href:string,checks:CompletenessCheck[]):CompletenessRecord{const complete=checks.filter(c=>c.complete).length;return{entityType,entityCode,label,href,complete,total:checks.length,percent:Math.round((complete/checks.length)*100),checks};}

export function evaluateCorporateDataQuality(snapshot:QualitySnapshot):{findings:DataQualityFinding[];completeness:CompletenessRecord[]}{
  const findings:DataQualityFinding[]=[];
  const profiles:CompletenessRecord[]=[];

  for(const site of snapshot.sites){
    const activeCoverage=site.coverage.filter(c=>c.isActive);
    if(site.isActive&&activeCoverage.length===0)findings.push(finding({severity:"REVIEW",rule:"ACTIVE_SITE_NO_COVERAGE",title:"Active Site has no active service coverage",detail:`${site.name} has no active Site ↔ Counterparty service relationship recorded. Confirm whether this is intentional.`,href:`/admin/corporate/sites/${site.id}`,entityType:"SITE",entityCode:site.code}));
    const groups=new Map<string,typeof activeCoverage>();for(const row of activeCoverage){const key=`${row.counterpartyId}::${row.serviceCategory.toUpperCase()}::${(row.roleCode??"").toUpperCase()}`;groups.set(key,[...(groups.get(key)??[]),row]);}
    for(const [key,rows] of groups)if(rows.length>1)findings.push(finding({severity:"ACTION",rule:"DUPLICATE_SERVICE_COVERAGE",title:"Duplicate active service coverage",detail:`${site.name} has ${rows.length} active coverage records with natural key ${key}.`,href:`/admin/corporate/sites/${site.id}`,entityType:"SITE",entityCode:site.code}));
    const primaryGroups=new Map<string,number>();for(const row of activeCoverage.filter(c=>c.isPrimary)){const key=row.serviceCategory.toUpperCase();primaryGroups.set(key,(primaryGroups.get(key)??0)+1);}for(const [category,count] of primaryGroups)if(count>1)findings.push(finding({severity:"ACTION",rule:"MULTIPLE_PRIMARY_PROVIDERS",title:"Multiple primary providers",detail:`${site.name} has ${count} active primary providers for ${category}.`,href:`/admin/corporate/sites/${site.id}`,entityType:"SITE",entityCode:site.code}));
    profiles.push(completeness("SITE",site.code,site.name,`/admin/corporate/sites/${site.id}`,[{label:"Site type",complete:Boolean(site.type)},{label:"Organization",complete:Boolean(site.organization)},{label:"Location",complete:Boolean(site.city&&site.countryCode)},{label:"Timezone",complete:Boolean(site.timezone)},{label:"Service coverage",complete:!site.isActive||activeCoverage.length>0}]));
  }

  for(const cp of snapshot.counterparties){
    const activeContacts=cp.contacts.filter(c=>c.isActive);
    if(cp.isActive&&activeContacts.length===0)findings.push(finding({severity:"REVIEW",rule:"ACTIVE_COUNTERPARTY_NO_CONTACT",title:"Active Counterparty has no active contact",detail:`${cp.name} has no active named contact. Add at least one operational/billing contact if applicable.`,href:`/admin/corporate/counterparties/${cp.id}`,entityType:"COUNTERPARTY",entityCode:cp.code}));
    if(cp.isActive&&!cp.registrationNo&&!cp.taxId)findings.push(finding({severity:"REVIEW",rule:"COUNTERPARTY_IDENTITY_WEAK",title:"Counterparty legal identifiers are incomplete",detail:`${cp.name} has neither registration number nor tax identifier recorded.`,href:`/admin/corporate/counterparties/${cp.id}`,entityType:"COUNTERPARTY",entityCode:cp.code}));
    const emailCounts=new Map<string,number>();for(const contact of cp.contacts){if(contact.email){const email=contact.email.toLowerCase();emailCounts.set(email,(emailCounts.get(email)??0)+1);}}for(const [email,count] of emailCounts)if(count>1)findings.push(finding({severity:"ACTION",rule:"DUPLICATE_CONTACT_EMAIL",title:"Duplicate contact identity",detail:`${cp.name} has ${count} contacts using ${email}. Relational import would treat this identity as a conflict.`,href:`/admin/corporate/counterparties/${cp.id}`,entityType:"COUNTERPARTY",entityCode:cp.code}));
    if(activeContacts.filter(c=>c.isPrimary).length>1)findings.push(finding({severity:"ACTION",rule:"MULTIPLE_PRIMARY_CONTACTS",title:"Multiple primary contacts",detail:`${cp.name} has more than one active primary contact.`,href:`/admin/corporate/counterparties/${cp.id}`,entityType:"COUNTERPARTY",entityCode:cp.code}));
    profiles.push(completeness("COUNTERPARTY",cp.code,cp.name,`/admin/corporate/counterparties/${cp.id}`,[{label:"Legal identity",complete:Boolean(cp.registrationNo||cp.taxId)},{label:"Country",complete:Boolean(cp.countryCode)},{label:"Active contact",complete:!cp.isActive||activeContacts.length>0},{label:"Default currency",complete:Boolean(cp.defaultCurrency)},{label:"Payment terms",complete:cp.paymentTermsDays!=null}]));
  }

  for(const ob of snapshot.obligations){
    const active=ob.status==="ACTIVE";
    const activeSites=ob.sites.filter(s=>s.isActive);
    if(active&&activeSites.length===0)findings.push(finding({severity:"REVIEW",rule:"ACTIVE_OBLIGATION_NO_SITE",title:"Active obligation has no Site",detail:`${ob.title} is active but is not linked to an operating Site. Confirm whether the agreement is location-independent.`,href:`/admin/corporate/obligations/${ob.id}`,entityType:"OBLIGATION",entityCode:ob.code}));
    const activeParties=ob.parties.filter(p=>p.isActive);
    const primary=activeParties.filter(p=>p.isPrimary);
    if(active&&!primary.some(p=>p.counterpartyId===ob.counterpartyId))findings.push(finding({severity:"ACTION",rule:"PRIMARY_PARTY_DRIFT",title:"Primary party graph is out of sync",detail:`${ob.title} primary counterparty is not represented by a matching primary Obligation Party edge.`,href:`/admin/corporate/obligations/${ob.id}`,entityType:"OBLIGATION",entityCode:ob.code}));
    if(primary.length>1)findings.push(finding({severity:"ACTION",rule:"MULTIPLE_PRIMARY_OBLIGATION_PARTIES",title:"Multiple primary obligation parties",detail:`${ob.title} has ${primary.length} parties marked primary.`,href:`/admin/corporate/obligations/${ob.id}`,entityType:"OBLIGATION",entityCode:ob.code}));
    for(const line of ob.lines){if(active&&line.isActive&&line.recurring&&!line.nextDueDate)findings.push(finding({severity:"ACTION",rule:"RECURRING_LINE_NO_NEXT_DUE",title:"Recurring line has no next due date",detail:`${ob.code} / ${line.code} is recurring and active but has no next-due pointer.`,href:`/admin/corporate/obligations/${ob.id}/lines`,entityType:"LINE",entityCode:`${ob.code}/${line.code}`}));}
    profiles.push(completeness("OBLIGATION",ob.code,ob.title,`/admin/corporate/obligations/${ob.id}`,[{label:"Category & organization",complete:Boolean(ob.category&&ob.organization)},{label:"Site context",complete:activeSites.length>0},{label:"Primary party",complete:primary.length===1},{label:"Agreement lines",complete:ob.lines.length>0},{label:"Required contract evidence",complete:!ob.contractRequired||Boolean(ob.contractReference||ob.contractFileUrl)}]));
  }

  const severityOrder={ACTION:0,REVIEW:1};findings.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]||a.entityCode.localeCompare(b.entityCode));profiles.sort((a,b)=>a.percent-b.percent||a.entityCode.localeCompare(b.entityCode));
  return{findings,completeness:profiles};
}

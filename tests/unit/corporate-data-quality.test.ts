import { describe, expect, it } from "vitest";

import { evaluateCorporateDataQuality, type QualitySnapshot } from "@/lib/corporate-admin/data-quality";

function base(): QualitySnapshot {
  return {
    sites: [{ id:"s1", code:"SITE-1", name:"HQ", type:"OFFICE", isActive:true, organization:null, city:null, countryCode:null, timezone:null, coverage:[] }],
    counterparties: [{ id:"c1", code:"CP-1", name:"Vendor", type:"VENDOR", isActive:true, registrationNo:null, taxId:null, countryCode:null, defaultCurrency:null, paymentTermsDays:null, contacts:[] }],
    obligations: [{ id:"o1", code:"ADM-1", title:"HQ tenancy", category:"TENANCY", organization:"ORG", status:"ACTIVE", counterpartyId:"c1", contractRequired:true, contractReference:null, contractFileUrl:null, sites:[], parties:[], lines:[{id:"l1",code:"RENT",name:"Rent",recurring:true,nextDueDate:null,isActive:true}] }],
  };
}

describe("Corporate data quality", () => {
  it("surfaces deterministic relationship and schedule gaps", () => {
    const result = evaluateCorporateDataQuality(base());
    const rules = result.findings.map(item=>item.rule);
    expect(rules).toContain("ACTIVE_SITE_NO_COVERAGE");
    expect(rules).toContain("ACTIVE_COUNTERPARTY_NO_CONTACT");
    expect(rules).toContain("ACTIVE_OBLIGATION_NO_SITE");
    expect(rules).toContain("PRIMARY_PARTY_DRIFT");
    expect(rules).toContain("RECURRING_LINE_NO_NEXT_DUE");
  });

  it("detects duplicate contact identities", () => {
    const snapshot = base();
    snapshot.counterparties[0].contacts = [
      {id:"a",email:"ops@example.com",isPrimary:false,isActive:true},
      {id:"b",email:"OPS@example.com",isPrimary:false,isActive:true},
    ];
    expect(evaluateCorporateDataQuality(snapshot).findings.some(item=>item.rule==="DUPLICATE_CONTACT_EMAIL")).toBe(true);
  });

  it("detects duplicate service coverage and competing primaries", () => {
    const snapshot = base();
    snapshot.sites[0].coverage = [
      {id:"a",counterpartyId:"c1",serviceCategory:"CLEANING",roleCode:"PRIMARY",isPrimary:true,isActive:true},
      {id:"b",counterpartyId:"c1",serviceCategory:"CLEANING",roleCode:"PRIMARY",isPrimary:true,isActive:true},
    ];
    const rules = evaluateCorporateDataQuality(snapshot).findings.map(item=>item.rule);
    expect(rules).toContain("DUPLICATE_SERVICE_COVERAGE");
    expect(rules).toContain("MULTIPLE_PRIMARY_PROVIDERS");
  });

  it("computes explainable completeness rather than an opaque score", () => {
    const result = evaluateCorporateDataQuality(base());
    const site = result.completeness.find(item=>item.entityType==="SITE")!;
    expect(site.total).toBe(5);
    expect(site.percent).toBe(20);
    expect(site.checks.map(check=>check.label)).toEqual(["Site type","Organization","Location","Timezone","Service coverage"]);
  });

  it("removes key findings when the graph is complete", () => {
    const snapshot = base();
    snapshot.sites[0] = {...snapshot.sites[0],organization:"ORG",city:"Klang",countryCode:"MY",timezone:"Asia/Kuala_Lumpur",coverage:[{id:"cov",counterpartyId:"c1",serviceCategory:"CLEANING",roleCode:"PRIMARY",isPrimary:true,isActive:true}]};
    snapshot.counterparties[0] = {...snapshot.counterparties[0],registrationNo:"REG",countryCode:"MY",defaultCurrency:"MYR",paymentTermsDays:30,contacts:[{id:"ct",email:"ops@example.com",isPrimary:true,isActive:true}]};
    snapshot.obligations[0] = {...snapshot.obligations[0],sites:[{siteId:"s1"}],parties:[{counterpartyId:"c1",roleCode:"PRIMARY",isPrimary:true}],contractReference:"TA-1",lines:[{id:"l1",code:"RENT",name:"Rent",recurring:true,nextDueDate:"2026-09-01",isActive:true}]};
    const rules = evaluateCorporateDataQuality(snapshot).findings.map(item=>item.rule);
    expect(rules).not.toContain("ACTIVE_SITE_NO_COVERAGE");
    expect(rules).not.toContain("ACTIVE_COUNTERPARTY_NO_CONTACT");
    expect(rules).not.toContain("PRIMARY_PARTY_DRIFT");
    expect(rules).not.toContain("RECURRING_LINE_NO_NEXT_DUE");
  });
});

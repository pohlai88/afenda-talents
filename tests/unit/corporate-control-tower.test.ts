import { describe, expect, it } from "vitest";

import { addDays, inBucket, managementSummary, reminderCopy, reminderEligible } from "@/lib/corporate-admin/control-tower";
import type { WorkItemRow } from "@/lib/corporate-admin/work-items";

const today = "2026-08-13";
function item(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id:"w1",title:"Renew lift maintenance",description:null,status:"OPEN",priority:"HIGH",ownerId:"u1",ownerName:"Owner",
    sourceType:"OBLIGATION",sourceId:"o1",sourceKey:"test:o1",sourceHref:"/admin/corporate/obligations/o1",dueDate:today,
    escalationLevel:0,escalateAfter:null,escalatedAt:null,acknowledgedAt:null,resolvedAt:null,resolutionNote:null,
    createdAt:new Date("2026-08-01T00:00:00Z"),updatedAt:new Date("2026-08-01T00:00:00Z"),...overrides,
  };
}

describe("Corporate control tower",()=>{
  it("adds calendar days deterministically",()=>expect(addDays("2026-12-30",3)).toBe("2027-01-02"));

  it("separates today, this-week and overdue views",()=>{
    expect(inBucket(item(),"TODAY",today,"u1")).toBe(true);
    expect(inBucket(item({dueDate:"2026-08-16"}),"THIS_WEEK",today,"u1")).toBe(true);
    expect(inBucket(item({dueDate:"2026-08-12"}),"THIS_WEEK",today,"u1")).toBe(false);
  });

  it("derives personal, escalated and unassigned lenses from authoritative work state",()=>{
    expect(inBucket(item(),"AWAITING_ME",today,"u1")).toBe(true);
    expect(inBucket(item({escalationLevel:2}),"ESCALATED",today,"u2")).toBe(true);
    expect(inBucket(item({ownerId:null,ownerName:null}),"UNASSIGNED",today,"u1")).toBe(true);
  });

  it("never reminds resolved or unassigned work",()=>{
    expect(reminderEligible(item({status:"RESOLVED"}),today)).toBe(false);
    expect(reminderEligible(item({ownerId:null}),today)).toBe(false);
    expect(reminderEligible(item({dueDate:"2026-08-21"}),today)).toBe(false);
    expect(reminderEligible(item({dueDate:"2026-08-20"}),today)).toBe(true);
  });

  it("produces plain reminder copy without recipient PII",()=>{
    const copy=reminderCopy(item({dueDate:"2026-08-10",escalationLevel:2}),today);
    expect(copy.subject).toContain("Renew lift maintenance");
    expect(copy.body).toContain("3 days overdue");
    expect(copy.body).toContain("Escalation: L2");
    expect(copy.body).not.toContain("@");
  });

  it("builds explainable management exception counts",()=>{
    const summary=managementSummary([
      item(),
      item({id:"w2",dueDate:"2026-08-12",escalationLevel:1}),
      item({id:"w3",ownerId:null,ownerName:null,dueDate:"2026-08-18"}),
      item({id:"w4",status:"RESOLVED",dueDate:"2026-08-11"}),
    ],today);
    expect(summary).toEqual({open:3,dueToday:1,dueThisWeek:2,overdue:1,escalated:1,unassigned:1});
  });
});

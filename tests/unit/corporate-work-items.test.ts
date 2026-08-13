import { describe, expect, it } from "vitest";

import { createWorkItemSchema, deriveEscalationLevel, updateWorkItemSchema, workItemAttention } from "@/lib/corporate-admin/work-items";

describe("Corporate administrative work items", () => {
  it("accepts a governed work item linked to a Corporate source", () => {
    const parsed = createWorkItemSchema.parse({
      title: "Review Klang HQ tenancy renewal",
      priority: "HIGH",
      sourceType: "OBLIGATION",
      sourceId: "ob-1",
      sourceKey: "renewal:ob-1",
      sourceHref: "/admin/corporate/obligations/ob-1",
      dueDate: "2026-08-20",
    });
    expect(parsed.sourceType).toBe("OBLIGATION");
    expect(parsed.priority).toBe("HIGH");
  });

  it("rejects non-Corporate deep links", () => {
    expect(() => createWorkItemSchema.parse({ title:"x", sourceType:"SITE", sourceHref:"/admin/users" })).toThrow();
  });

  it("supports acknowledgement, progress and resolution statuses", () => {
    for (const status of ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"] as const) {
      expect(updateWorkItemSchema.parse({ status }).status).toBe(status);
    }
  });

  it("escalates overdue work deterministically", () => {
    expect(deriveEscalationLevel("OPEN", "2026-08-13", "2026-08-13")).toBe(0);
    expect(deriveEscalationLevel("OPEN", "2026-08-12", "2026-08-13")).toBe(1);
    expect(deriveEscalationLevel("ACKNOWLEDGED", "2026-08-10", "2026-08-13")).toBe(2);
    expect(deriveEscalationLevel("IN_PROGRESS", "2026-08-01", "2026-08-13")).toBe(3);
    expect(deriveEscalationLevel("RESOLVED", "2026-08-01", "2026-08-13")).toBe(0);
  });

  it("derives overdue and due-soon attention without a hidden score", () => {
    expect(workItemAttention({ status:"OPEN", dueDate:"2026-08-12", escalationLevel:1 }, "2026-08-13")).toBe("OVERDUE");
    expect(workItemAttention({ status:"OPEN", dueDate:"2026-08-18", escalationLevel:0 }, "2026-08-13")).toBe("DUE_SOON");
    expect(workItemAttention({ status:"RESOLVED", dueDate:"2026-08-01", escalationLevel:0 }, "2026-08-13")).toBe("RESOLVED");
  });
});

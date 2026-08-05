import { describe, expect, it } from "vitest";
import { STATUSES } from "@/lib/status-constants";
import {
  EXCEPTION_STAGES,
  STAGE_EXPLANATION,
  WORKFLOW_STAGES,
  statusDisplay,
} from "@/lib/status-display";

describe("statusDisplay", () => {
  it("gives every canonical status a readable label", () => {
    for (const status of STATUSES) {
      const { label } = statusDisplay(status);
      expect(label.length).toBeGreaterThan(0);
      // The whole point of this module: no raw code reaches the UI.
      expect(label).not.toBe(status);
      expect(label).not.toMatch(/^[A-Z_]+$/);
    }
  });

  it("does not call SUBMITTED 'Completed' — the profile is not available yet", () => {
    expect(statusDisplay("SUBMITTED").label).toBe("Processing results");
    expect(statusDisplay("SCORED").label).toBe("Ready for review");
  });

  it("uses the agreed label for each status", () => {
    expect(statusDisplay("DRAFT").label).toBe("Invitation prepared");
    expect(statusDisplay("SENT").label).toBe("Invitation sent");
    expect(statusDisplay("STARTED").label).toBe("Assessment started");
    expect(statusDisplay("EXPIRED").label).toBe("Invitation expired");
    expect(statusDisplay("REVOKED").label).toBe("Invitation revoked");
  });

  it("marks exceptions with the exception tone and never a destructive one", () => {
    expect(statusDisplay("EXPIRED").tone).toBe("exception");
    expect(statusDisplay("REVOKED").tone).toBe("exception");
  });
});

describe("workflow stages", () => {
  it("is a current-state distribution, not a funnel: stages are mutually exclusive", () => {
    expect(WORKFLOW_STAGES).toEqual(["SENT", "STARTED", "SUBMITTED", "SCORED"]);
    expect(new Set(WORKFLOW_STAGES).size).toBe(WORKFLOW_STAGES.length);
  });

  it("keeps exceptions out of the progress stages", () => {
    expect(EXCEPTION_STAGES).toEqual(["EXPIRED", "REVOKED"]);
    for (const stage of EXCEPTION_STAGES) {
      expect(WORKFLOW_STAGES).not.toContain(stage);
    }
  });

  it("explains every stage it renders", () => {
    for (const stage of WORKFLOW_STAGES) {
      expect(STAGE_EXPLANATION[stage].length).toBeGreaterThan(0);
    }
  });
});

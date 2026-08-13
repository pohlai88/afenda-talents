import { describe, expect, it } from "vitest";
import { CORPORATE_DAILY_CRON, CORPORATE_WEEKLY_CRON, corporateAutomationJobForSchedule } from "@/lib/corporate-admin/automation";

describe("Corporate recurring automation schedule",()=>{
  it("maps the declared daily schedule",()=>{expect(CORPORATE_DAILY_CRON).toBe("30 0 * * *");expect(corporateAutomationJobForSchedule(CORPORATE_DAILY_CRON)).toBe("DAILY");});
  it("maps the declared weekly schedule",()=>{expect(CORPORATE_WEEKLY_CRON).toBe("45 0 * * 1");expect(corporateAutomationJobForSchedule(CORPORATE_WEEKLY_CRON)).toBe("WEEKLY");});
  it("rejects unknown or missing schedules",()=>{expect(corporateAutomationJobForSchedule("0 0 * * *")).toBeNull();expect(corporateAutomationJobForSchedule(null)).toBeNull();});
});
import type { AutomationJobType } from "@/lib/corporate-admin/automation-server";

export const CORPORATE_DAILY_CRON = "30 0 * * *";
export const CORPORATE_WEEKLY_CRON = "45 0 * * 1";

export function corporateAutomationJobForSchedule(schedule:string|null):AutomationJobType|null{
  if(schedule===CORPORATE_DAILY_CRON)return "DAILY";
  if(schedule===CORPORATE_WEEKLY_CRON)return "WEEKLY";
  return null;
}

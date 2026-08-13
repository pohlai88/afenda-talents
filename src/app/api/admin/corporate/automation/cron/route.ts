import { runCorporateAutomation, type AutomationJobType } from "@/lib/corporate-admin/automation-server";
import { env } from "@/lib/env";

const DAILY_SCHEDULE = "30 0 * * *";
const WEEKLY_SCHEDULE = "45 0 * * 1";

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const schedule = request.headers.get("x-vercel-cron-schedule");
  let jobType: AutomationJobType;
  if (schedule === DAILY_SCHEDULE) jobType = "DAILY";
  else if (schedule === WEEKLY_SCHEDULE) jobType = "WEEKLY";
  else return Response.json({ error: "Unknown Corporate automation schedule" }, { status: 400 });

  try {
    const result = await runCorporateAutomation(jobType);
    return Response.json({ ok: true, jobType, ...result });
  } catch {
    return Response.json({ ok: false, jobType, error: "Corporate automation failed" }, { status: 500 });
  }
}
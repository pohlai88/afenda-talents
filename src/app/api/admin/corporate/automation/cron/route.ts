import { corporateAutomationJobForSchedule } from "@/lib/corporate-admin/automation";
import { runCorporateAutomation } from "@/lib/corporate-admin/automation-server";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const jobType = corporateAutomationJobForSchedule(request.headers.get("x-vercel-cron-schedule"));
  if (!jobType) return Response.json({ error: "Unknown Corporate automation schedule" }, { status: 400 });

  try {
    const result = await runCorporateAutomation(jobType);
    return Response.json({ ok: true, jobType, ...result });
  } catch {
    return Response.json({ ok: false, jobType, error: "Corporate automation failed" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { generateInAppReminders, sendReminder } from "@/lib/corporate-admin/control-tower-server";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("GENERATE_IN_APP") }),
  z.object({ action: z.literal("SEND"), workItemId: z.string().min(1), channel: z.enum(["IN_APP", "EMAIL"]) }),
]);

export async function POST(request: Request) {
  try {
    const session = await requireWorkspaceAdmin();
    const body = bodySchema.parse(await request.json());
    if (body.action === "GENERATE_IN_APP") {
      return NextResponse.json(await generateInAppReminders(session.userId));
    }
    return NextResponse.json(await sendReminder({ workItemId: body.workItemId, channel: body.channel }, session.userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process reminder";
    return NextResponse.json({ error: message }, { status: message.includes("Not authenticated") ? 401 : message.includes("Forbidden") ? 403 : 400 });
  }
}

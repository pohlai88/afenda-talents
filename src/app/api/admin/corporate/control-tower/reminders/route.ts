import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { generateInAppReminders, sendReminder } from "@/lib/corporate-admin/control-tower-server";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("GENERATE_IN_APP") }),
  z.object({ action: z.literal("SEND"), workItemId: z.string().min(1), channel: z.enum(["IN_APP", "EMAIL"]) }),
]);

export async function POST(request: Request) {
  let session;
  try {
    session = await requireWorkspaceAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That reminder action is not recognised" }, { status: 400 });
  }

  const body = parsed.data;
  try {
    if (body.action === "GENERATE_IN_APP") {
      return NextResponse.json(await generateInAppReminders(session.userId));
    }
    return NextResponse.json(await sendReminder({ workItemId: body.workItemId, channel: body.channel }, session.userId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not process reminder" },
      { status: 400 },
    );
  }
}

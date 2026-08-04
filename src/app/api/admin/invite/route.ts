import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { applyStatus } from "@/lib/status";
import { expiryFromNow, generateToken, hashToken, inviteUrl } from "@/lib/tokens";
import { sendInvitation } from "@/lib/email";

export const runtime = "nodejs";

const bodySchema = z.object({
  candidates: z
    .array(z.object({ fullName: z.string().min(1).max(120), email: z.email() }))
    .min(1)
    .max(200),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a name and a valid email for each candidate" },
      { status: 400 },
    );
  }

  let invited = 0;
  let skipped = 0;

  for (const entry of parsed.data.candidates) {
    const email = entry.email.trim().toLowerCase();
    if (await db.candidate.findUnique({ where: { email } })) {
      skipped++;
      continue;
    }

    // The raw token exists only long enough to build the URL. It is never stored,
    // logged, audited, or returned. Build-skill invariant 2.
    const token = generateToken();
    const expiresAt = expiryFromNow(env.INVITE_TTL_DAYS);

    const candidate = await db.candidate.create({
      data: { email, fullName: entry.fullName.trim(), tokenHash: hashToken(token), expiresAt },
    });

    await applyStatus(candidate.id, "SENT", { sentAt: new Date() });
    await sendInvitation(email, candidate.fullName, inviteUrl(env.APP_URL, token), expiresAt);
    await audit("admin", "invite.created", candidate.id);
    invited++;
  }

  return NextResponse.json({ invited, skipped });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { CANDIDATE_COOKIE, createCandidateToken, resolveToken } from "@/lib/auth-candidate";

export const runtime = "nodejs";

/**
 * Candidate entry point. This is a Route Handler rather than a page because Next only
 * allows cookie writes in Route Handlers and Server Actions — a Server Component render
 * that calls cookies().set() throws at runtime.
 *
 * GET /a/{token}: validate the token, stamp openedAt, set the candidate cookie, and
 * redirect — to the consent page normally, straight to the assessment if already
 * STARTED, and to the completion page for unknown/expired/revoked/finished tokens
 * (all indistinguishable from outside).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = env.APP_URL;

  const candidate = await resolveToken(token);
  if (!candidate) {
    return NextResponse.redirect(new URL(`/a/${token}/done`, base));
  }

  if (!candidate.openedAt) {
    await db.candidate.update({ where: { id: candidate.id }, data: { openedAt: new Date() } });
  }

  const destination = candidate.status === "STARTED" ? "assessment" : "consent";
  const response = NextResponse.redirect(new URL(`/a/${token}/${destination}`, base));
  response.cookies.set(CANDIDATE_COOKIE, await createCandidateToken(candidate.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 4 * 60 * 60,
  });
  return response;
}

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Coarse gate — BY CHOICE, not by constraint. See DECISIONS.md D7.
 *
 * This checks only that a cookie's signature is valid and unexpired. It deliberately does
 * not query the database, so it cannot know that a candidate was revoked or has already
 * submitted. Every handler behind this gate re-reads the candidate row and re-checks
 * status and expiry. Do not move authorisation logic here.
 *
 * Cookie names are string literals rather than imports so this file depends on neither
 * auth module — importing either would blur the admin/candidate separation this repo
 * enforces (build-skill invariant 7).
 */
const ADMIN_COOKIE = "afenda_admin";
const CANDIDATE_COOKIE = "afenda_candidate";

const secret = () => new TextEncoder().encode(process.env.APP_SECRET!);

async function claims(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The door itself must stay reachable.
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/candidate")) {
    const payload = await claims(request.cookies.get(CANDIDATE_COOKIE)?.value);
    if (!payload?.candidateId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Any hiring role passes the gate; ADMIN-only actions re-check in their handlers
  // via requireAdmin(), consistent with this gate being coarse by design.
  const payload = await claims(request.cookies.get(ADMIN_COOKIE)?.value);
  if (payload?.role === "ADMIN" || payload?.role === "VIEWER") return NextResponse.next();

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/candidate/:path*"],
};

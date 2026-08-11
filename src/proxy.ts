import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Coarse cryptographic gate only. Current account role, revocation version, deletion,
 * password-change state, candidate status, and expiry are all re-checked by server
 * pages and route handlers against Postgres.
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

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/candidate")) {
    const payload = await claims(request.cookies.get(CANDIDATE_COOKIE)?.value);
    if (typeof payload?.assignmentId !== "string") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const payload = await claims(request.cookies.get(ADMIN_COOKIE)?.value);
  const hiringClaimIsPresent =
    typeof payload?.userId === "string" &&
    typeof payload.sessionVersion === "number" &&
    Number.isInteger(payload.sessionVersion) &&
    payload.sessionVersion >= 0;
  if (hiringClaimIsPresent) return NextResponse.next();

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/candidate/:path*"],
};

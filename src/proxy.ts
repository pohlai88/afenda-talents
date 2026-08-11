import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { resolveHiringSession, verifyHiringSessionToken } from "@/lib/auth-session";
import { ADMIN_COOKIE } from "@/lib/hiring-roles";
import {
  PAGE_AUTH_HEADERS,
  PAGE_AUTH_HEADER_NAMES,
} from "@/lib/page-auth-headers";

/**
 * Page requests receive a live database-backed authority snapshot through internal
 * request headers. This keeps cookies() out of the React render tree while preserving
 * immediate role/session-version/account-state revocation.
 *
 * API handlers never receive those internal headers and continue to perform their own
 * DB-near requireAdmin/requireHiringUser checks from the signed cookie.
 */
const CANDIDATE_COOKIE = "afenda_candidate";

const secret = () => new TextEncoder().encode(process.env.APP_SECRET!);

async function candidateClaims(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}

function sanitizedRequestHeaders(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  for (const name of PAGE_AUTH_HEADER_NAMES) requestHeaders.delete(name);
  return requestHeaders;
}

function continueWithoutPageAuthority(request: NextRequest) {
  return NextResponse.next({
    request: { headers: sanitizedRequestHeaders(request) },
  });
}

function withPageAuthority(
  request: NextRequest,
  session: {
    userId: string;
    role: "ADMIN" | "VIEWER";
    sessionVersion: number;
    mustChangePassword: boolean;
  },
) {
  const requestHeaders = sanitizedRequestHeaders(request);
  requestHeaders.set(PAGE_AUTH_HEADERS.authenticated, "1");
  requestHeaders.set(PAGE_AUTH_HEADERS.userId, session.userId);
  requestHeaders.set(PAGE_AUTH_HEADERS.role, session.role);
  requestHeaders.set(
    PAGE_AUTH_HEADERS.sessionVersion,
    String(session.sessionVersion),
  );
  requestHeaders.set(
    PAGE_AUTH_HEADERS.mustChangePassword,
    session.mustChangePassword ? "1" : "0",
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return continueWithoutPageAuthority(request);
  }

  if (pathname.startsWith("/api/candidate")) {
    const payload = await candidateClaims(
      request.cookies.get(CANDIDATE_COOKIE)?.value,
    );
    if (typeof payload?.assignmentId !== "string") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return continueWithoutPageAuthority(request);
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;

  if (pathname.startsWith("/api/admin")) {
    const claims = await verifyHiringSessionToken(token);
    if (!claims) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return continueWithoutPageAuthority(request);
  }

  let session;
  try {
    session = await resolveHiringSession(token);
  } catch {
    return new NextResponse("Service temporarily unavailable", { status: 503 });
  }
  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (pathname === "/admin/change-password") {
    if (!session.mustChangePassword) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return withPageAuthority(request, session);
  }

  if (session.mustChangePassword) {
    return NextResponse.redirect(new URL("/admin/change-password", request.url));
  }

  return withPageAuthority(request, session);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/candidate/:path*"],
};

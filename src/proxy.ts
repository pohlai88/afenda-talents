import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { audit } from "@/lib/audit";
import { resolveHiringSession, verifyHiringSessionToken } from "@/lib/auth-session";
import { CORPORATE_AUTOMATION_CRON_PATH } from "@/lib/corporate-admin/automation";
import { db } from "@/lib/db";
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

function isPrefetch(request: NextRequest): boolean {
  return (
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("next-router-prefetch") === "1"
  );
}

async function auditResultNavigation(
  request: NextRequest,
  actor: string,
  pathname: string,
): Promise<void> {
  if (request.method !== "GET" || isPrefetch(request)) return;
  const match = pathname.match(/^\/admin\/candidate\/([^/]+)$/);
  if (!match) return;

  const assignmentId = decodeURIComponent(match[1]);
  const assignment = await db.candidateAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, result: { select: { id: true } } },
  });
  if (assignment?.result) {
    await audit(actor, "result.viewed", assignment.id, {
      source: "profile-navigation",
    });
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return continueWithoutPageAuthority(request);
  }

  /**
   * Vercel Cron carries a CRON_SECRET bearer token, never an admin session cookie, so
   * the coarse /api/admin gate below would reject the scheduled run before its handler
   * ever executes. The exemption is exact-path — not a prefix — and still strips the
   * internal page-authority headers, so it grants no authority of its own: the route
   * remains responsible for verifying CRON_SECRET.
   */
  if (pathname === CORPORATE_AUTOMATION_CRON_PATH) {
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

  try {
    await auditResultNavigation(request, session.userId, pathname);
  } catch (error) {
    console.error("Result view audit failed", {
      assignmentPath: pathname,
      error: error instanceof Error ? error.message : "Unknown audit error",
    });
  }

  return withPageAuthority(request, session);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/candidate/:path*"],
};

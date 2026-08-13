import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  CORPORATE_AUTOMATION_CRON_PATH,
  CORPORATE_DAILY_CRON,
  CORPORATE_WEEKLY_CRON,
} from "@/lib/corporate-admin/automation";
import { PAGE_AUTH_HEADERS } from "@/lib/page-auth-headers";

/**
 * The scheduled run authenticates with a bearer token, so it must survive the coarse
 * /api/admin session gate in the proxy AND still be rejected by the route when the
 * token is absent or wrong. Both halves are asserted here: an exemption without the
 * route check would publish the job, and a route check behind a closed gate is dead code.
 */
const { CRON_SECRET } = vi.hoisted(() => ({ CRON_SECRET: "unit-test-cron-secret" }));

vi.mock("@/lib/db", () => ({ db: {} }));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, env: { ...actual.env, CRON_SECRET } };
});

vi.mock("@/lib/corporate-admin/automation-server", () => ({
  runCorporateAutomation: vi.fn(async () => ({ status: "COMPLETED", runId: "run_test" })),
}));

const { proxy } = await import("@/proxy");
const { GET } = await import("@/app/api/admin/corporate/automation/cron/route");

const url = (path: string) => `http://localhost:3000${path}`;

function cronRequest(headers: Record<string, string>) {
  return new Request(url(CORPORATE_AUTOMATION_CRON_PATH), { headers });
}

describe("Corporate automation cron reaches its handler", () => {
  it("exempts the scheduled path from the admin session gate", async () => {
    const response = await proxy(new NextRequest(url(CORPORATE_AUTOMATION_CRON_PATH)));
    expect(response.status).toBe(200);
  });

  it("keeps every other admin API path behind the session gate", async () => {
    const response = await proxy(new NextRequest(url("/api/admin/corporate/obligations")));
    expect(response.status).toBe(401);
  });

  it("exempts the exact path only, never a prefix of it", async () => {
    const response = await proxy(
      new NextRequest(url(`${CORPORATE_AUTOMATION_CRON_PATH}/replay`)),
    );
    expect(response.status).toBe(401);
  });

  it("forwards the cron credential but strips spoofed page-authority headers", async () => {
    const response = await proxy(
      new NextRequest(url(CORPORATE_AUTOMATION_CRON_PATH), {
        headers: {
          authorization: `Bearer ${CRON_SECRET}`,
          [PAGE_AUTH_HEADERS.authenticated]: "1",
          [PAGE_AUTH_HEADERS.role]: "ADMIN",
        },
      }),
    );

    // x-middleware-override-headers is the allowlist of request headers Next forwards.
    const forwarded = (response.headers.get("x-middleware-override-headers") ?? "").split(",");
    expect(forwarded).toContain("authorization");
    expect(forwarded).not.toContain(PAGE_AUTH_HEADERS.authenticated);
    expect(forwarded).not.toContain(PAGE_AUTH_HEADERS.role);
    expect(
      response.headers.get(`x-middleware-request-${PAGE_AUTH_HEADERS.authenticated}`),
    ).toBeNull();
  });
});

describe("Corporate automation cron route still verifies CRON_SECRET", () => {
  it("rejects a request with no authorization header", async () => {
    expect((await GET(cronRequest({}))).status).toBe(401);
  });

  it("rejects a request with the wrong bearer token", async () => {
    expect((await GET(cronRequest({ authorization: "Bearer wrong-secret" }))).status).toBe(401);
  });

  it("rejects an authorized request carrying an undeclared schedule", async () => {
    const response = await GET(
      cronRequest({
        authorization: `Bearer ${CRON_SECRET}`,
        "x-vercel-cron-schedule": "0 0 * * *",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("runs the daily job for an authorized request on the declared schedule", async () => {
    const response = await GET(
      cronRequest({
        authorization: `Bearer ${CRON_SECRET}`,
        "x-vercel-cron-schedule": CORPORATE_DAILY_CRON,
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, jobType: "DAILY" });
  });
});

describe("Corporate automation cron declaration", () => {
  it("schedules both jobs against the exempted path", () => {
    const vercel = JSON.parse(
      readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"),
    ) as { crons: Array<{ path: string; schedule: string }> };

    expect(vercel.crons.map((cron) => cron.path)).toEqual([
      CORPORATE_AUTOMATION_CRON_PATH,
      CORPORATE_AUTOMATION_CRON_PATH,
    ]);
    expect(vercel.crons.map((cron) => cron.schedule)).toEqual([
      CORPORATE_DAILY_CRON,
      CORPORATE_WEEKLY_CRON,
    ]);
  });
});

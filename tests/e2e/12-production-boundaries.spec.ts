import { expect, test } from "@playwright/test";

test.describe("production service boundaries", () => {
  test("liveness and database readiness are healthy", async ({ request }) => {
    const live = await request.get("/api/health/live");
    expect(live.status()).toBe(200);
    await expect(live.json()).resolves.toMatchObject({
      ok: true,
      service: "afenda-talents",
    });

    const ready = await request.get("/api/health/ready");
    expect(ready.status()).toBe(200);
    await expect(ready.json()).resolves.toMatchObject({
      ok: true,
      service: "afenda-talents",
      database: "ready",
    });
  });

  test("sensitive surfaces are not cached, indexed, or framed", async ({ request }) => {
    const response = await request.get("/admin/login");
    expect(response.status()).toBe(200);

    const headers = response.headers();
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["x-robots-tag"]).toContain("noindex");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });
});

import { describe, expect, it } from "vitest";
import { isLoginModeAllowed } from "@/lib/developer-access";

const developerEmail = "developer@example.com";

describe("developer login access", () => {
  it("keeps the ordinary hiring login available to both hiring roles", () => {
    expect(
      isLoginModeAllowed({
        mode: "hiring",
        email: "viewer@example.com",
        role: "VIEWER",
        developerEmail,
      }),
    ).toBe(true);
  });

  it("allows the designated administrator through developer login", () => {
    expect(
      isLoginModeAllowed({
        mode: "developer",
        email: "Developer@Example.com",
        role: "ADMIN",
        developerEmail,
      }),
    ).toBe(true);
  });

  it("rejects a viewer even when the email matches", () => {
    expect(
      isLoginModeAllowed({
        mode: "developer",
        email: developerEmail,
        role: "VIEWER",
        developerEmail,
      }),
    ).toBe(false);
  });

  it("rejects another administrator from the designated developer path", () => {
    expect(
      isLoginModeAllowed({
        mode: "developer",
        email: "another-admin@example.com",
        role: "ADMIN",
        developerEmail,
      }),
    ).toBe(false);
  });
});

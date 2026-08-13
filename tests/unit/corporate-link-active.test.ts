import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Corporate never deletes. A link attached by mistake is stood down with isActive,
 * so both link tables must carry the flag the other entities already have.
 */
describe("Obligation link tables can be stood down", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

  function model(name: string): string {
    const start = schema.indexOf(`model ${name} {`);
    return schema.slice(start, schema.indexOf("\n}", start));
  }

  it("gives obligation parties an active flag", () => {
    expect(model("AdministrativeObligationParty")).toMatch(/isActive\s+Boolean\s+@default\(true\)/);
  });

  it("gives obligation site links an active flag", () => {
    expect(model("AdministrativeObligationSite")).toMatch(/isActive\s+Boolean\s+@default\(true\)/);
  });
});

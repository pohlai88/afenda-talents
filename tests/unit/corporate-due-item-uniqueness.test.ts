import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A line may legitimately hold two due items on one date (a split invoice, a partial
 * billing plus a top-up). The period label is what distinguishes them, so it must stay
 * part of the unique key — otherwise the second item is rejected again.
 */
describe("ObligationDueItem uniqueness", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  const model = schema.slice(
    schema.indexOf("model ObligationDueItem"),
    schema.indexOf("model AdministrativePayment"),
  );

  it("keys due items by line, date and period label", () => {
    expect(model).toContain("@@unique([lineId, dueDate, periodLabel])");
  });

  it("no longer keys them by line and date alone", () => {
    expect(model).not.toContain("@@unique([lineId, dueDate])");
  });
});

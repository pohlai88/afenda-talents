import { describe, expect, it } from "vitest";
import {
  duplicateDueItemMessage,
  PERIOD_LABEL_MAX_LENGTH,
  suggestPeriodLabel,
} from "@/lib/corporate-admin/obligation-lines";

describe("suggestPeriodLabel", () => {
  it("returns the base label when nothing is taken", () => {
    expect(suggestPeriodLabel("Feb 2026", [])).toBe("Feb 2026");
  });

  it("appends a counter when the base is taken", () => {
    expect(suggestPeriodLabel("Feb 2026", ["Feb 2026"])).toBe("Feb 2026 · 2");
  });

  it("keeps counting past consecutive taken labels", () => {
    expect(suggestPeriodLabel("Feb 2026", ["Feb 2026", "Feb 2026 · 2"])).toBe("Feb 2026 · 3");
  });

  it("fills a gap in the sequence", () => {
    expect(suggestPeriodLabel("Feb 2026", ["Feb 2026", "Feb 2026 · 3"])).toBe("Feb 2026 · 2");
  });

  it("ignores surrounding whitespace on both sides", () => {
    expect(suggestPeriodLabel("  Feb 2026  ", [" Feb 2026 "])).toBe("Feb 2026 · 2");
  });

  it("truncates rather than exceeding the period label cap", () => {
    const base = "A".repeat(PERIOD_LABEL_MAX_LENGTH);
    const result = suggestPeriodLabel(base, [base]);
    expect(result.length).toBeLessThanOrEqual(PERIOD_LABEL_MAX_LENGTH);
    expect(result.endsWith(" · 2")).toBe(true);
  });

  it("never returns a label longer than the cap even when free", () => {
    const base = "B".repeat(PERIOD_LABEL_MAX_LENGTH + 20);
    expect(suggestPeriodLabel(base, []).length).toBe(PERIOD_LABEL_MAX_LENGTH);
  });
});

describe("duplicateDueItemMessage", () => {
  it("names the conflicting label so the user knows what to change", () => {
    expect(duplicateDueItemMessage("Feb 2026")).toBe(
      'A due item labelled "Feb 2026" already exists for that line and date. Give this one a different period label.',
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  EXPIRING_WITHIN_HOURS,
  STALLED_AFTER_HOURS,
  UNOPENED_AFTER_HOURS,
  hiringAttention,
  workspaceAttention,
  type CandidateFacts,
} from "@/lib/attention";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

const base: CandidateFacts = {
  id: "c1",
  fullName: "Amira Yusof",
  status: "SENT",
  sentAt: hoursAgo(1),
  openedAt: null,
  startedAt: null,
  expiresAt: hoursAhead(24 * 14),
  lastResponseAt: null,
  computedAt: null,
  lastViewedAt: null,
};

const kinds = (facts: CandidateFacts[]) => hiringAttention(facts, NOW).map((i) => i.kind);

describe("invitation not opened", () => {
  it("flags a SENT invitation unopened for longer than the threshold", () => {
    expect(kinds([{ ...base, sentAt: hoursAgo(UNOPENED_AFTER_HOURS + 1) }])).toContain("unopened");
  });

  it("does not flag one that is exactly at the threshold", () => {
    expect(kinds([{ ...base, sentAt: hoursAgo(UNOPENED_AFTER_HOURS) }])).not.toContain("unopened");
  });

  it("does not flag one that has been opened", () => {
    const opened = { ...base, sentAt: hoursAgo(200), openedAt: hoursAgo(100) };
    expect(kinds([opened])).not.toContain("unopened");
  });
});

describe("assessment in progress", () => {
  it("measures staleness from the last saved answer, not from startedAt", () => {
    const stale = {
      ...base,
      status: "STARTED",
      startedAt: hoursAgo(500),
      lastResponseAt: hoursAgo(1),
    };
    // Started long ago but answering a minute ago — that is progress, not a stall.
    expect(kinds([stale])).not.toContain("stalled");
  });

  it("flags a candidate whose last answer is older than the threshold", () => {
    const stalled = {
      ...base,
      status: "STARTED",
      startedAt: hoursAgo(500),
      lastResponseAt: hoursAgo(STALLED_AFTER_HOURS + 1),
    };
    expect(kinds([stalled])).toContain("stalled");
  });

  it("falls back to startedAt when no answer has been saved yet", () => {
    const noAnswers = {
      ...base,
      status: "STARTED",
      startedAt: hoursAgo(STALLED_AFTER_HOURS + 1),
      lastResponseAt: null,
    };
    expect(kinds([noAnswers])).toContain("stalled");
  });
});

describe("expiring soon", () => {
  it("flags a SENT invitation expiring inside the window", () => {
    expect(kinds([{ ...base, expiresAt: hoursAhead(EXPIRING_WITHIN_HOURS - 1) }])).toContain(
      "expiring",
    );
  });

  it("flags a STARTED invitation expiring inside the window", () => {
    const started = { ...base, status: "STARTED", expiresAt: hoursAhead(1) };
    expect(kinds([started])).toContain("expiring");
  });

  it("does not flag one that already expired", () => {
    const past = { ...base, expiresAt: hoursAgo(1) };
    expect(kinds([past])).not.toContain("expiring");
  });

  it("does not flag a submitted candidate", () => {
    const submitted = { ...base, status: "SUBMITTED", expiresAt: hoursAhead(1) };
    expect(kinds([submitted])).not.toContain("expiring");
  });
});

describe("profile awaiting first review", () => {
  it("flags a scored profile nobody has opened", () => {
    const scored = { ...base, status: "SCORED", computedAt: hoursAgo(10), lastViewedAt: null };
    expect(kinds([scored])).toContain("awaiting-review");
  });

  it("clears once viewed after the result was computed", () => {
    const viewed = {
      ...base,
      status: "SCORED",
      computedAt: hoursAgo(10),
      lastViewedAt: hoursAgo(2),
    };
    expect(kinds([viewed])).not.toContain("awaiting-review");
  });

  it("still flags when the only view predates the result", () => {
    const rescored = {
      ...base,
      status: "SCORED",
      computedAt: hoursAgo(2),
      lastViewedAt: hoursAgo(10),
    };
    expect(kinds([rescored])).toContain("awaiting-review");
  });
});

describe("ordering", () => {
  it("puts time-critical items first and never orders by anything about the answers", () => {
    const items = hiringAttention(
      [
        { ...base, id: "a", status: "SCORED", computedAt: hoursAgo(10), lastViewedAt: null },
        { ...base, id: "b", expiresAt: hoursAhead(2) },
      ],
      NOW,
    );
    expect(items[0].kind).toBe("expiring");
  });
});

describe("workspaceAttention", () => {
  it("returns only users still on an issued password", () => {
    const items = workspaceAttention([
      { id: "u1", name: "Ada", mustChangePassword: true },
      { id: "u2", name: "Grace", mustChangePassword: false },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Ada");
  });
});

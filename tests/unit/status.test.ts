import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  IllegalStatusTransition,
  STATUSES,
  type Status,
} from "@/lib/status";

const legal: [Status, Status][] = [
  ["DRAFT", "SENT"],
  ["SENT", "STARTED"],
  ["SENT", "EXPIRED"],
  ["SENT", "REVOKED"],
  ["STARTED", "SUBMITTED"],
  ["STARTED", "EXPIRED"],
  ["STARTED", "REVOKED"],
  ["SUBMITTED", "SCORED"],
  ["EXPIRED", "SENT"],
  ["REVOKED", "SENT"],
];

const illegal: [Status, Status][] = [
  ["DRAFT", "STARTED"],
  ["DRAFT", "REVOKED"],
  ["SENT", "SUBMITTED"],
  ["SENT", "SCORED"],
  ["STARTED", "SENT"],
  ["SUBMITTED", "STARTED"],
  ["SUBMITTED", "REVOKED"],
  ["SCORED", "SENT"],
  ["SCORED", "SCORED"],
  ["REVOKED", "STARTED"],
  ["EXPIRED", "STARTED"],
];

describe("canTransition", () => {
  it.each(legal)("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(illegal)("rejects %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("treats SCORED as terminal", () => {
    for (const to of STATUSES) expect(canTransition("SCORED", to)).toBe(false);
  });

  it("covers exactly the ten legal transitions and no more", () => {
    // The transition table is the security boundary; this pins its exact size so an
    // accidental extra edge (e.g. SCORED -> SENT "for testing") fails a test.
    let count = 0;
    for (const from of STATUSES) for (const to of STATUSES) if (canTransition(from, to)) count++;
    expect(count).toBe(legal.length);
  });
});

describe("assertTransition", () => {
  it("returns silently for a legal transition", () => {
    expect(() => assertTransition("DRAFT", "SENT")).not.toThrow();
  });

  it("throws IllegalStatusTransition for an illegal one", () => {
    expect(() => assertTransition("SCORED", "SENT")).toThrow(IllegalStatusTransition);
  });

  it("names both states in the error message", () => {
    expect(() => assertTransition("SCORED", "SENT")).toThrow(/SCORED.*SENT/);
  });
});

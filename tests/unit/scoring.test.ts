import { describe, it, expect } from "vitest";
import instrument from "../../data/instrument.json";
import {
  score,
  itemScore,
  scaleDimension,
  bandFor,
  totalSecondsFrom,
  type ItemDef,
  type RawResponse,
} from "@/lib/scoring";

const items = instrument.items as ItemDef[];

function responses(overrides: Record<string, number> = {}, msOnItem = 20_000): RawResponse[] {
  return items.map((i) => ({
    itemId: i.id,
    value: overrides[i.id] ?? 3,
    msOnItem,
  }));
}

describe("itemScore", () => {
  it("returns the value unchanged for a normal item", () => {
    expect(itemScore(4, false)).toBe(4);
  });

  it("inverts a reverse-scored item around 6", () => {
    expect(itemScore(4, true)).toBe(2);
    expect(itemScore(1, true)).toBe(5);
  });
});

describe("scaleDimension", () => {
  it("maps the raw range 6..30 onto 0..100", () => {
    expect(scaleDimension(6)).toBe(0);
    expect(scaleDimension(18)).toBe(50);
    expect(scaleDimension(30)).toBe(100);
  });
});

describe("bandFor", () => {
  it("places 44 in Developing and 45 in Effective", () => {
    expect(bandFor(44)).toBe("Developing");
    expect(bandFor(45)).toBe("Effective");
  });

  it("places 69 in Effective and 70 in Strong", () => {
    expect(bandFor(69)).toBe("Effective");
    expect(bandFor(70)).toBe("Strong");
  });
});

describe("totalSecondsFrom", () => {
  it("sums per-item milliseconds", () => {
    expect(
      totalSecondsFrom([
        { itemId: "a", value: 3, msOnItem: 1_000 },
        { itemId: "b", value: 3, msOnItem: 2_000 },
      ]),
    ).toBe(3);
  });

  it("clamps each item at 60 seconds so an idle tab cannot inflate the total", () => {
    expect(
      totalSecondsFrom([
        { itemId: "a", value: 3, msOnItem: 9_000_000 },
        { itemId: "b", value: 3, msOnItem: 5_000 },
      ]),
    ).toBe(65);
  });
});

describe("score — dimensions", () => {
  it("scores an all-3s response set at 50 across all five dimensions", () => {
    const result = score(items, responses());
    expect(result.dimensions).toHaveLength(5);
    for (const d of result.dimensions) {
      expect(d.raw).toBe(18);
      expect(d.scaled).toBe(50);
      expect(d.band).toBe("Effective");
    }
  });

  it("reflects a reverse-scored item in the dimension raw total", () => {
    // WER-3 is reverse scored. Answering 5 scores 1, i.e. two below the all-3s baseline.
    const result = score(items, responses({ "WER-3": 5 }));
    const wer = result.dimensions.find((d) => d.code === "WER")!;
    expect(wer.raw).toBe(16);
  });

  it("excludes validity items from every competency dimension", () => {
    const result = score(items, responses({ "VAL-1": 5, "VAL-2": 5, "VAL-3": 5, "VAL-4": 5 }));
    expect(result.dimensions.map((d) => d.code)).toEqual(["WER", "COM", "PSL", "ADR", "INA"]);
    for (const d of result.dimensions) expect(d.raw).toBe(18);
  });
});

function flag(result: ReturnType<typeof score>, code: string) {
  return result.flags.find((f) => f.code === code)!;
}

describe("score — validity flags", () => {
  it("computes all four flags every time", () => {
    const codes = score(items, responses()).flags.map((f) => f.code);
    expect(codes).toEqual([
      "impressionManagement",
      "inconsistentResponding",
      "straightLining",
      "rushed",
    ]);
  });

  it("triggers impressionManagement when VAL-1 + VAL-2 >= 8", () => {
    const r = responses({ "VAL-1": 4, "VAL-2": 4 });
    expect(flag(score(items, r), "impressionManagement").triggered).toBe(true);
  });

  it("does not trigger impressionManagement at 7", () => {
    const r = responses({ "VAL-1": 4, "VAL-2": 3 });
    expect(flag(score(items, r), "impressionManagement").triggered).toBe(false);
  });

  it("triggers inconsistentResponding when the paired gaps total 4 or more", () => {
    // |WER-1 - VAL-3| = 2, |INA-1 - VAL-4| = 2  => 4
    const r = responses({ "WER-1": 5, "VAL-3": 3, "INA-1": 5, "VAL-4": 3 });
    expect(flag(score(items, r), "inconsistentResponding").triggered).toBe(true);
  });

  it("does not trigger inconsistentResponding when the gaps total 3", () => {
    const r = responses({ "WER-1": 5, "VAL-3": 3, "INA-1": 4, "VAL-4": 3 });
    expect(flag(score(items, r), "inconsistentResponding").triggered).toBe(false);
  });

  it("triggers straightLining on 12 identical consecutive raw values", () => {
    // All 34 answered 3 is one run of 34.
    expect(flag(score(items, responses()), "straightLining").triggered).toBe(true);
  });

  it("does not trigger straightLining when no run reaches 12", () => {
    // Vary every 11th item in presentation order, capping the longest run at 10.
    const breakers: Record<string, number> = {};
    for (const i of items) if (i.order % 11 === 0) breakers[i.id] = 5;
    expect(flag(score(items, responses(breakers)), "straightLining").triggered).toBe(false);
  });

  it("triggers rushed below 240 seconds", () => {
    // 34 items x 5s = 170s
    expect(flag(score(items, responses({}, 5_000)), "rushed").triggered).toBe(true);
  });

  it("does not trigger rushed at 240 seconds or above", () => {
    // 34 items x 20s = 680s
    expect(flag(score(items, responses({}, 20_000)), "rushed").triggered).toBe(false);
  });

  it("describes rushed timing as self-reported", () => {
    expect(flag(score(items, responses({}, 5_000)), "rushed").reason).toMatch(/self-reported/i);
  });

  it("never lets a flag change a dimension score", () => {
    const clean = score(items, responses({}, 20_000));
    const flagged = score(items, responses({ "VAL-1": 5, "VAL-2": 5 }, 1_000));
    expect(flagged.dimensions).toEqual(clean.dimensions);
  });
});

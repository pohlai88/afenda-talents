/**
 * Pure scoring for the Afenda Talents instrument.
 *
 * This module must never import Prisma or touch the database. Items and responses
 * arrive as arguments so that a Result is always recomputable from Response rows alone.
 * See DECISIONS.md and the build spec §5.
 */

export type Band = "Developing" | "Effective" | "Strong";

export type ItemDef = {
  id: string;
  dimension: string;
  order: number;
  reverseScored: boolean;
  isValidity: boolean;
};

export type RawResponse = { itemId: string; value: number; msOnItem: number };

export type DimensionScore = { code: string; raw: number; scaled: number; band: Band };
export type ValidityFlag = { code: string; triggered: boolean; reason: string };

export type Scored = {
  dimensions: DimensionScore[];
  flags: ValidityFlag[];
  totalSeconds: number;
};

export const COMPETENCY_CODES = ["WER", "COM", "PSL", "ADR", "INA"] as const;
export const MS_PER_ITEM_CAP = 60_000;
export const STRAIGHT_LINE_RUN = 12;
export const RUSHED_SECONDS = 240;

export function itemScore(value: number, reverseScored: boolean): number {
  return reverseScored ? 6 - value : value;
}

export function scaleDimension(raw: number): number {
  return Math.round(((raw - 6) / 24) * 100);
}

export function bandFor(scaled: number): Band {
  if (scaled < 45) return "Developing";
  if (scaled < 70) return "Effective";
  return "Strong";
}

/**
 * Seconds of attention, not wall-clock elapsed time.
 *
 * The spec requires candidates to be able to close the browser mid-assessment and return,
 * so submittedAt - startedAt would record hours and make the `rushed` flag unreachable for
 * exactly the people it exists to detect. Each item is clamped so an idle tab cannot inflate
 * the total. See DECISIONS.md D5.
 */
export function totalSecondsFrom(responses: RawResponse[]): number {
  const ms = responses.reduce((sum, r) => sum + Math.min(r.msOnItem, MS_PER_ITEM_CAP), 0);
  return Math.round(ms / 1000);
}

function longestRun(values: number[]): number {
  let best = 0;
  let current = 0;
  let previous: number | null = null;
  for (const v of values) {
    current = v === previous ? current + 1 : 1;
    previous = v;
    if (current > best) best = current;
  }
  return best;
}

function buildFlags(
  items: ItemDef[],
  valueOf: (id: string) => number,
  totalSeconds: number,
): ValidityFlag[] {
  const impression = valueOf("VAL-1") + valueOf("VAL-2") >= 8;

  const inconsistency =
    Math.abs(valueOf("WER-1") - valueOf("VAL-3")) + Math.abs(valueOf("INA-1") - valueOf("VAL-4"));
  const inconsistent = inconsistency >= 4;

  const inOrder = [...items].sort((a, b) => a.order - b.order).map((i) => valueOf(i.id));
  const run = longestRun(inOrder);
  const straightLining = run >= STRAIGHT_LINE_RUN;

  const rushed = totalSeconds < RUSHED_SECONDS;

  return [
    {
      code: "impressionManagement",
      triggered: impression,
      reason: impression
        ? "Both social-desirability items were answered at the top of the scale."
        : "Social-desirability items were answered in the expected range.",
    },
    {
      code: "inconsistentResponding",
      triggered: inconsistent,
      reason: inconsistent
        ? "Paired items covering the same ground were answered differently."
        : "Paired items were answered consistently.",
    },
    {
      code: "straightLining",
      triggered: straightLining,
      reason: straightLining
        ? `The same answer was given on ${run} items in a row.`
        : "Answers varied across the questionnaire.",
    },
    {
      // Timing is measured by client-side JavaScript and posted by the browser, so the
      // wording must attribute it. See DECISIONS.md D6.
      code: "rushed",
      triggered: rushed,
      reason: rushed
        ? "Self-reported time on task was under 4 minutes."
        : "Self-reported time on task was 4 minutes or more.",
    },
  ];
}

export function score(items: ItemDef[], responses: RawResponse[]): Scored {
  const byId = new Map(responses.map((r) => [r.itemId, r.value]));
  const valueOf = (id: string) => byId.get(id) ?? 0;

  const dimensions = COMPETENCY_CODES.map<DimensionScore>((code) => {
    const raw = items
      .filter((i) => i.dimension === code)
      .reduce((sum, i) => sum + itemScore(valueOf(i.id), i.reverseScored), 0);
    const scaled = scaleDimension(raw);
    return { code, raw, scaled, band: bandFor(scaled) };
  });

  const totalSeconds = totalSecondsFrom(responses);

  return { dimensions, flags: buildFlags(items, valueOf, totalSeconds), totalSeconds };
}

# Afenda Talents — Profile Facade (Chunk 3 / P3)

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Upgrade the SCORED candidate profile to match UI/UX §8.3–8.4 and §8.6 — DimensionScale with band regions, structured Response context, item responses grouped by dimension — without dimension narratives or hiring conversation guide (D17 deferred).

**Architecture:** Presentational components under `src/components/candidate-detail/`. Shared labels in `src/lib/instrument-labels.ts`. Scoring bands stay in `lib/scoring.ts` (`bandFor` thresholds 45 / 70). Page wires `ScoredProfile` only.

**Out of scope:** Dimension narrative essays; hiring conversation guide (§8.5); radar chart.

## File Structure

| File | Role |
|---|---|
| `src/lib/instrument-labels.ts` | Dimension names, Likert labels, flag titles |
| `src/components/candidate-detail/dimension-scale.tsx` | 0–100 scale with Developing / Effective / Strong |
| `src/components/candidate-detail/response-context.tsx` | Neutral indicators + timing copy |
| `src/components/item-responses-table.tsx` | Grouped by dimension, collapsed, labels |
| `src/components/dimension-bar.tsx` | Alias → DimensionScale |
| `src/app/admin/(shell)/candidate/[id]/page.tsx` | Wire new components |

---

### Task 1: Labels + DimensionScale — [x]

### Task 2: Response context panel — [x]

### Task 3: Item responses grouping — [x]

### Task 4: Wire page + verify — [x]

## Done when (evidence)

- `pnpm typecheck` — clean
- `pnpm test -- tests/unit/instrument-labels.test.ts` — 3 passed
- `pnpm test:e2e -- tests/e2e/05-results.spec.ts tests/e2e/09-candidate-detail.spec.ts` — 3 passed
- Mechanical invariants — pass
- No narratives / conversation guide shipped (D17)

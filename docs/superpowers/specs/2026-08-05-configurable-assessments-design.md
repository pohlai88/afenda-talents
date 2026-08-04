# Afenda Talents — Configurable Assessments Design

**Date:** 2026-08-05  
**Status:** Approved  
**Decision:** [DECISIONS.md D18](../../../DECISIONS.md)  
**Relationship:** Supersedes MVP build-spec assumptions of one seeded instrument, no item editor, and one implicit hiring round. Nine build-skill invariants still apply; status and identity move from `Candidate` to `CandidateAssignment`.

---

## 1. Overview

Afenda Talents supports multiple assessment instruments via a **document-on-version** model: mutable drafts on `Assessment`, immutable published snapshots on `AssessmentVersion`, thin `HiringRound` assignment of a published version, and `CandidateAssignment` as the invite/completion unit.

Delivery is split:

| Delivery | Ships |
|---|---|
| **1** | Versioned model, migration, version-driven scoring, thin rounds, assignment auth, invite via OPEN round, read-only Assessments |
| **2** | Visual builder (Likert, short/long text, info), preview, validate/publish, duplicate/archive, save-as-template action |

---

## 2. Goals

- Administrators know which assessment exists and can assign different published versions to different rounds.
- Historical responses never change when a draft is edited.
- Same person may complete multiple assessments (one assignment per round).
- Scoring remains pure and recomputable from responses + frozen version document.
- No overall score, ranking, or pass/fail.

## 3. Non-goals

Through Delivery 2:

- Separate Templates gallery product nav; READY_FOR_REVIEW workflow; Assessment Designer role
- Choice / multi-select / ranking / matrix / branching / file upload
- Response-context **rule editor UI** (rules are version-driven; editor later)
- Item weights; collaborative editing; public/anonymous forms
- Overall scores, ranking, benchmarking, psychometric-validation claims
- Round open/close **dates** and per-round team membership (thin rounds only)

---

## 4. Domain model

```text
Assessment
  draftDocument (Json, mutable)
  isSystem, kind (SYSTEM | ORGANISATION | TEMPLATE)
  → AssessmentVersion[] (immutable document snapshots)

HiringRound
  name, status (DRAFT | OPEN | CLOSED | ARCHIVED)
  assessmentVersionId  — editable only while DRAFT; locked on OPEN

Candidate (identity: email unique, fullName)
CandidateAssignment
  candidateId, hiringRoundId
  assessmentVersionId  — copied from round at creation; never changes
  tokenHash, status, expiry, consent/timing stamps
  → Response[] (assignmentId + questionId string)
  → Result? (assignmentId unique)
```

**Invariant:** `assignment.assessmentVersionId === round.assessmentVersionId` at creation; both immutable thereafter for that assignment. Round version may not change after OPEN.

### Round lifecycle

```text
DRAFT → OPEN → CLOSED → ARCHIVED
DRAFT → ARCHIVED   (abandoned)
```

| Status | Allowed |
|---|---|
| DRAFT | Rename; change assessment version |
| OPEN | Invite; candidates complete; version locked |
| CLOSED | No new invites; existing links remain valid (Delivery 1) |
| ARCHIVED | Read-only historical access |

Invitations require an **OPEN** round.

### Candidate session

Cookie name may remain `afenda_candidate`. JWT claim is `{ assignmentId }`. Helpers: `createAssignmentSession`, `currentAssignmentId`, `requireAssignment`, `resolveAssignmentToken`.

---

## 5. Instrument document schema

One Zod schema for draft and published `document`. `schemaVersion: 1` for Core v1 and Delivery 1–2.

Terminology: **items** (not “questions”), because information blocks are non-answerable.

```ts
type InstrumentDocument = {
  schemaVersion: 1;
  title: string;
  internalDescription?: string;
  candidateIntroduction: string;
  consent: {
    purpose: string;
    whatWeCollect: string;
    whoSeesIt: string;
    retention: string; // may interpolate RETENTION_DAYS at render
  };
  estimatedMinutes: number;
  displayMode: "continuous" | "section";
  dimensions: {
    id: string;
    code: string;
    name: string;
    description?: string;
    order: number;
  }[];
  bands: {
    id: string;
    name: string;
    minScaled: number; // inclusive
    maxScaled: number; // inclusive
  }[];
  sections: {
    id: string;
    title: string;
    introduction?: string;
    order: number;
    itemIds: string[];
  }[];
  items: InstrumentItem[];
  responseContextRules: ResponseContextRule[];
};

type InstrumentItem =
  | {
      type: "likert";
      id: string;
      text: string;
      required: boolean;
      min: 1;
      max: 5;
      labels: string[]; // length = max - min + 1
      scored: boolean;
      dimensionId: string | null;
      reverseScored: boolean;
    }
  | {
      type: "short_text" | "long_text";
      id: string;
      text: string;
      required: boolean;
      helperText?: string;
      maxLength?: number;
    }
  | {
      type: "info";
      id: string;
      body: string;
    };

type ResponseContextRule = {
  id: string;
  type:
    | "social_desirability"
    | "consistency_pairs"
    | "straight_line"
    | "rushed_time";
  label: string;
  enabled: boolean;
  managerExplanation: string;
  // type-specific:
  itemIds?: string[]; // social_desirability sum
  threshold?: number;
  pairs?: [string, string][]; // consistency_pairs
  runLength?: number; // straight_line
  // rushed_time uses threshold as max totalSeconds exclusive trigger
};
```

### Section / item integrity (publish + seed validation)

- Every item appears in **exactly one** section.
- Every `itemIds` entry exists on `items`.
- No duplicate IDs within a section.
- Section `order` deterministic; item order within section is array order.
- Empty sections are **rejected** (info content must be an `info` item in some section).

---

## 6. Scoring

Pure module: `scoreAssessment({ versionDocument, responses })`. No Prisma.

```ts
type ResponseContextOutcome = {
  ruleId: string;
  type:
    | "social_desirability"
    | "consistency_pairs"
    | "straight_line"
    | "rushed_time";
  label: string;
  triggered: boolean;
  reason: string;
};

type ScoreAssessmentResult = {
  dimensions: {
    id: string;
    code: string;
    raw: number;
    scaled: number;
    band: { id: string; name: string };
  }[];
  responseContext: ResponseContextOutcome[];
  totalSeconds: number;
};
```

### Likert scoring

```text
scoredValue = reverseScored ? 6 − responseValue : responseValue
```

Reverse scoring does **not** change the dimension’s possible range.

For a dimension with `n` scored Likert 1–5 items:

```text
minimumPossible = n × 1
maximumPossible = n × 5
scaled = round(((raw − minimumPossible) / (maximumPossible − minimumPossible)) × 100)
```

Publication rejects `n === 0` (denominator would be zero).

Band: first band where `minScaled ≤ scaled ≤ maxScaled`. Bands must cover 0–100 without overlap.

### Timing (unchanged D5/D6)

`totalSeconds = Σ min(msOnItem, 60_000) / 1000` (answerable items only). HR copy remains self-reported.

### Response-context evaluation

Rules from the version document only. Never alter dimension scores. Never reject candidates.

Core v1 embeds today’s four rules (VAL-1+VAL-2 ≥ 8; WER-1/VAL-3 + INA-1/VAL-4 abs-diff ≥ 4; straight run ≥ 12; totalSeconds < 240).

### Runtime validation

Delivery 1: parse/validate embedded Core v1 before backfill; parse stored version document again before every score. Do not trust JSON because it was valid at insert.

---

## 7. Migration (expand → backfill → cutover → contract)

`prisma migrate deploy` does **not** read `instrument.json`.

1. **Expand** — Add `Assessment`, `AssessmentVersion`, `HiringRound`, `CandidateAssignment`; nullable `assignmentId` / `assessmentVersionId` on Response/Result; keep legacy columns.
2. **Backfill** — Dedicated script embeds validated Core v1 document; creates system assessment + version 1 + default OPEN round; one assignment per existing candidate; remaps responses/results; parity checks.
3. **Cutover** — App reads/writes assignment model only.
4. **Contract** — Drop legacy lifecycle columns on Candidate (move to assignment), drop `Response.candidateId` / `Result.candidateId`, drop `Item`, enforce non-null FKs and uniques.

Rollback point: before contract, legacy columns still exist.

---

## 8. Admin surfaces

### Delivery 1

Nav: Overview, Candidates, **Hiring rounds**, **Assessments**, Invite, Team, Data & audit.

**Assessments** (read-only): name; kind System/Organisation; latest published version; whether a draft exists; rounds using it; preview. Avoid a single ambiguous status when draft and published coexist.

**Hiring rounds:** create (DRAFT), open (locks version), close, archive; invite only when OPEN.

**Invite:** select OPEN round first (implies version); email title/estimated time from version document.

### Delivery 2

Builder at `/admin/assessments/[id]/edit`; preview; validate; publish; duplicate; archive; new draft from published; save-as-template action. Psychometric honesty notice required.

System assessments cannot be deleted. Published versions are immutable. Creating a new draft from a system assessment may be restricted to authorised administrators or the governed Afenda operations path.

---

## 9. Audit

Meaningful domain events only (not autosave keystrokes). Meta: ids only (`assessmentId`, `versionId`, `roundId`, `assignmentId`).

Delivery 1: `assessment.seeded`, `round.created|opened|closed|archived`, assignment invite/resend/revoke (subject = assignmentId), existing consent/submit/view/export adapted to assignment.

Delivery 2: `assessment.created|duplicated|published|archived`, optional `draft.validated`.

---

## 10. Constraints preserved

- Two auth systems, never mixed.
- Raw tokens never logged/stored/audited.
- Status changes only via `lib/status.ts` (assignment-scoped).
- Zod on every API body.
- No pass/fail, ranking, or overall score.
- Candidate UI mobile-first.

---

## 11. Open permission note

Whether non-Afenda ADMINs may create a new draft from a system assessment is deferred; Delivery 1 does not ship draft creation for system templates. Delivery 2 must decide before enabling that action.

# Configurable Assessments — Delivery 2 + Contract

**Authority:** D18 · `docs/superpowers/specs/2026-08-05-configurable-assessments-design.md`

## Delivery 2
- Builder (Likert, short/long text, info, sections, dimensions, reverse)
- Server autosave, validate, publish, duplicate, new-draft, save-as-template
- Preview without assignment side effects
- Psychometric honesty notice

## Remaining — contract migration
After cutover is live: drop legacy Candidate lifecycle columns used only as expand bridge, drop Response.candidateId uniqueness path to assignment-only, drop Item table, make assignmentId/questionId required on Response, make Result.assignmentId required.

Do not run contract until expand + backfill + app cutover verified on the target database.

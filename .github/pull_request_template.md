## Purpose

<!-- What user-visible or operational problem does this change solve? -->

## Scope

<!-- List the routes, data models, workflows, or deployment settings changed. -->

## Risk and rollback

- [ ] I identified the highest-risk failure mode.
- [ ] I described how to roll back code and, when applicable, database changes.
- [ ] No secret, raw invitation/case token, personal data, or evidence content is included in this PR.

## Required verification

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm exec node scripts/check-invariants.mjs`
- [ ] `pnpm build`
- [ ] Relevant Playwright flow or an explicit reason it is not applicable
- [ ] Database migration tested against a clean database, when applicable
- [ ] Mobile candidate flow checked, when applicable
- [ ] Keyboard/accessibility impact checked, when applicable

## Product boundaries

- [ ] No candidate ranking, overall score, pass/fail, percentile, or automated hiring recommendation was introduced.
- [ ] Hiring-user and candidate authentication remain separate.
- [ ] Status transitions still pass through the authorised transition service.
- [ ] Audit metadata contains identifiers only, without names, emails, passwords, or raw tokens.
- [ ] The change respects the selected hiring-round or employee-case scope.

## Evidence

<!-- Paste concise test output, preview URL, screenshots, traces, or monitoring evidence. -->

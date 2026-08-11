# Production release and rollback runbook

Use this runbook for every Afenda Talents production release. Replace placeholders with the actual PR, migration, deployment, smoke record, and owner before approval.

## 1. Release record

- Change / PR:
- Release owner:
- Reviewer:
- Planned time:
- Database migration: yes / no
- User-visible workflows affected:
- Highest-risk failure mode:
- Rollback candidate deployment:
- Recovery owner:

## 2. Pre-release checks

### Repository

- [ ] PR is current with `main`.
- [ ] Required GitHub checks are green.
- [ ] Vercel preview is `READY`.
- [ ] No secret, raw invitation/case token, personal data, or evidence content appears in the diff, build output, tests, screenshots, or comments.
- [ ] Product invariants pass.
- [ ] Relevant desktop and mobile flows were exercised on the preview.

### Database

- [ ] Migration is represented by checked-in files.
- [ ] Migration applies to a clean database.
- [ ] Migration applies to a production-like branch or copy.
- [ ] Data backfill counts and parity checks are recorded.
- [ ] Lock, rewrite, and downtime risk are understood.
- [ ] Point-in-time recovery or a pre-migration snapshot is available.
- [ ] Rollback or forward-fix SQL is reviewed.

### External services

- [ ] Resend sending domain and sender are healthy.
- [ ] Neon compute and connection limits are healthy.
- [ ] Object storage and malware scanning are healthy when evidence upload is in scope.
- [ ] Monitoring and alert receivers are active.

## 3. Deployment

1. Record the current production deployment ID and aliases.
2. Merge the approved PR only after required checks pass.
3. Watch the Vercel production build until `READY` or `ERROR`.
4. Do not retry a failing migration blindly. Capture the exact failure and determine whether it is safe to retry.
5. Verify the production alias points to the intended commit.
6. Check runtime logs for new errors before performing the smoke test.

## 4. Production smoke test

Use synthetic records only.

### Service health

- [ ] `GET /api/health/live` returns HTTP 200.
- [ ] `GET /api/health/ready` returns HTTP 200.
- [ ] Admin and candidate routes return security and no-store headers.

### Hiring workspace

- [ ] Signed-out `/admin` redirects to login.
- [ ] A smoke hiring user can sign in.
- [ ] Overview and selected hiring round load.
- [ ] Candidate registry search and status filtering respond.
- [ ] Export remains ADMIN-only.

### Candidate assessment

- [ ] Create one synthetic invitation in a smoke round.
- [ ] Open the invitation on a mobile viewport.
- [ ] Consent, answer, autosave, refresh, and resume.
- [ ] Submit once.
- [ ] Repeat submit or refresh the completion route and confirm no duplicate result is created.
- [ ] Review the profile and print preview.
- [ ] Remove the smoke candidate after verification.

### Employee Verification

Do not perform a real employee-case smoke test until the separate application, named-account authentication, private object storage, and checked-in schema are released. Synthetic-only testing applies until then.

## 5. Monitoring window

For at least 30 minutes after promotion:

- watch 4xx and 5xx changes;
- watch p95 latency and database connection errors;
- watch email delivery failure and retry counts;
- watch authentication failures and rate-limit spikes;
- watch unexpected retention, purge, or evidence-access activity;
- confirm no PII or raw tokens appear in logs.

## 6. Rollback triggers

Rollback or disable the affected workflow when any of these occur:

- authentication or authorisation bypass;
- another person's data is exposed;
- raw token, password, database URL, or evidence content is logged;
- submissions produce missing or duplicate results;
- invitation status does not match delivery reality;
- migration leaves partial or inconsistent data;
- sustained elevated 5xx rate;
- candidate autosave or resume loses answers;
- destructive operation affects unintended records.

## 7. Rollback procedure

### Code-only release

1. Promote the last known-good Vercel deployment.
2. Confirm production aliases moved back.
3. rerun service-health and smoke checks;
4. keep the failed deployment and logs for investigation;
5. open an incident issue with timestamps and affected workflows.

### Database-compatible release

If the previous application version can read the new schema, promote the previous Vercel deployment and leave additive schema changes in place until a reviewed cleanup migration exists.

### Database-incompatible release

1. stop or disable writes to the affected workflow;
2. do not deploy an older application that cannot read the new schema;
3. restore from point-in-time recovery or apply the reviewed forward-fix;
4. reconcile records created between the recovery point and incident time;
5. resume traffic only after integrity checks and smoke tests pass.

## 8. Closure

- [ ] Smoke records removed.
- [ ] Monitoring window completed.
- [ ] Release record updated with deployment and migration IDs.
- [ ] Any deviation or incident documented.
- [ ] Follow-up issues assigned with severity and owner.

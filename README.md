# Afenda Talents

Pre-employment self-assessment. Invitation only, single hiring round, single admin.

- Requirements: `afenda-talents-mvp-build-spec.md`
- Architecture: `docs/superpowers/specs/2026-08-04-afenda-talents-architecture-design.md`
- Decisions log: `DECISIONS.md`
- Implementation plan: `docs/superpowers/plans/2026-08-04-afenda-talents-mvp.md`

## Local development

```bash
pnpm install
pnpm db:local            # embedded Postgres on :54329 — leave running (see DECISIONS.md D14)
cp .env.example .env     # then fill it in; local DB URLs are in scripts/local-db.ts
pnpm prisma migrate deploy
pnpm db:seed             # expect: "Seeded instrument. Item count: 34"
pnpm dev
```

With `RESEND_API_KEY` empty, every email prints to stdout including the invitation link —
that is how the flow is exercised locally.

## Tests

```bash
pnpm test        # Vitest: scoring, status, tokens, env, audit — no database needed
pnpm test:e2e    # Playwright against .env.test; covers spec §15 end to end
bash .claude/skills/afenda-talents-build/check-invariants.sh   # run bare, never piped
```

## Deploying (Phase 8 runbook)

1. **Generate production secrets** — both generated, never chosen:

   ```bash
   node -e "console.log('APP_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
   node -e "console.log('ADMIN_PASSWORD=' + require('crypto').randomBytes(24).toString('base64url'))"
   ```

   `lib/env.ts` refuses an `ADMIN_PASSWORD` under 24 characters at boot (DECISIONS.md D4).

2. **Neon**: create a project plus a `test` branch. Copy the **pooled** connection string
   (host contains `-pooler`) into `DATABASE_URL` and the **direct** one into `DIRECT_URL` —
   migrations fail through the pooler (D1). Put the `test` branch's pair in `.env.test`.

3. **Vercel**: import the repo and set every variable from `.env.example` for Production.
   No Dockerfile exists — the database is Neon, the app is serverless.

4. **Resend**: verify the sending domain, set `MAIL_FROM` to an address on it, and set
   `RESEND_API_KEY`. An unverified domain silently degrades deliverability.

5. **Migrate and seed production**:

   ```bash
   pnpm dotenv -e .env.production -- prisma migrate deploy
   pnpm dotenv -e .env.production -- prisma db seed
   ```

   Expect `Seeded instrument. Item count: 34`.

6. **Measure the cold start** (D11): leave the deployment idle 15 minutes so Neon
   autosuspends, then open a candidate link on a phone over mobile data and time it. Record
   the number under D11. Over ~5 seconds → paid Neon tier, or accept it in writing.

7. **Walk spec §15 by hand** on production with three real addresses. The Playwright suite
   covers the same ground, but this run proves the real host, database, email provider and
   a real phone work together.

8. **Verify nothing is reachable unauthenticated**:

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/admin          # 307 → login
   curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/api/admin/export    # 401
   curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/api/candidate/submit # 401
   curl -s -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/a/not-a-real-token  # 307 → done
   ```

## End of round

The consent text promises deletion after `RETENTION_DAYS` days. Honouring it is manual:
the dashboard's **Delete candidate data** section removes every candidate, response and
result; the audit log keeps an identity-free record that the purge happened.

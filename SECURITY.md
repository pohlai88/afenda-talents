# Security policy

Afenda Talents handles candidate identity, assessment responses, hiring-team accounts, invitation credentials, audit records, and—in the temporary verification module—employee case information. Please report suspected security weaknesses privately.

## Supported version

Security fixes are applied to the current production version on `main`. Older commits, preview deployments, local development environments, and forks are not supported releases.

## Reporting a vulnerability

Do **not** open a public issue containing a vulnerability, credential, personal information, invitation link, employee case link, database URL, access token, screenshot of private data, or evidence document.

Use GitHub's **Report a vulnerability** / private security advisory feature for this repository. Include:

- the affected route, component, or workflow;
- clear reproduction steps using synthetic data;
- the likely impact;
- whether the issue exposes identity, answers, credentials, tokens, evidence, or administrative actions;
- any suggested remediation;
- only redacted logs and screenshots.

If private security advisories are unavailable, contact the repository owner through a private channel and provide only enough information to establish a secure reporting channel.

## Response targets

The project aims to:

- acknowledge a report within two business days;
- confirm severity and affected environments as soon as practical;
- provide a remediation or containment plan before public disclosure;
- credit reporters who request recognition and follow coordinated disclosure.

These are operating targets rather than contractual service levels.

## Security boundaries

The following are intentional and must not be weakened during remediation:

- hiring-user and candidate authentication remain separate;
- raw invitation and case tokens are never logged or audited;
- routine UI never exposes passwords, session tokens, database credentials, or evidence contents;
- audit metadata contains identifiers, not names, emails, passwords, or raw tokens;
- candidate results never become rankings, pass/fail decisions, or automated hiring recommendations;
- destructive actions remain role-gated and explicitly confirmed.

## Testing rules

Use synthetic records only. Do not access, alter, download, retain, or disclose another person's data. Do not perform denial-of-service testing, automated credential attacks, broad scanning, social engineering, or testing against third-party providers without permission.

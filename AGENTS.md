# AGENTS.md - Entra Credential Monitor

Node CLI (TypeScript, ESM) that scans Microsoft Entra ID app registrations and
service principals for expired or soon-expiring secrets/certificates, then sends
an email report through Resend. The project is designed to run on a schedule in
GitHub Actions, Forgejo Actions, cron, or any other runner that can inject
environment variables.

README.md is the source of truth for user setup. This file covers development
notes that are easy to miss when editing code.

## Commands

```bash
pnpm install
pnpm dev              # tsx src/run.ts (no build)
pnpm build            # tsc -> dist/
pnpm test             # vitest run; pnpm exec vitest run <file> for one test
pnpm typecheck        # tsc --noEmit
pnpm lint             # biome check (lint + format check)
pnpm verify           # lint + typecheck + test + build
```

A real scan needs tenant and email credentials. For local development, copy
`.env.example` to `.env.local`, fill in values, and run:

```bash
pnpm exec tsx --env-file=.env.local src/run.ts
```

Secret managers are fine too. The app reads ordinary environment variables and
does not bundle dotenv.

## Structure

- `src/run.ts` - entry point; orchestrates the run and Healthchecks pings.
- `src/graph-client.ts` - Microsoft Graph client built on `@azure/identity` and
  `@microsoft/microsoft-graph-client`.
- `src/monitor/` - `AppRegistrationMonitor`, expiry analysis, findings, and
  self-monitoring.
- `src/email/` - Resend integration and email report templates.
- `src/schemas.ts` - Zod schemas for env config and Graph responses; the single
  source of valid env var names.
- `src/github-actions.ts` - GitHub/Forgejo-compatible log and summary helpers.
- `src/logger.ts` - Pino logger wiring; use `LOG_LEVEL` for runtime verbosity.

## Conventions

- Tenant config has two forms, both parsed in `src/schemas.ts`
  (`parseTenantConfigs`): `ENTRA_TENANTS` JSON array (preferred, takes
  precedence) or single-tenant `ENTRA_*` vars.
- Email-send failures get `error.emailError = true` so the error path does not
  try to email about a failed email.
- Only credentials expiring within `WARNING_DAYS` are analyzed.
- Biome owns lint and format: 2-space indent, single quotes, line width 100.
  Run `pnpm lint:fix` rather than hand-formatting.
- Report HTML must stay under roughly 102 KB or Gmail clips it. The long-expired
  tier is capped in `report-html.ts`; keep the size-budget test green.

## Public-Repo Boundary

- Do not commit real `.env` files, tenant names, tenant IDs, client IDs,
  recipient lists, Healthchecks URLs, or secret-manager references.
- Keep deployment-specific workflows as examples under `docs/`, not active
  scheduled workflows, unless they are safe for a fresh public clone.
- Peculiar Cloud branding in report templates is intentional; operator-specific
  customer data is not.

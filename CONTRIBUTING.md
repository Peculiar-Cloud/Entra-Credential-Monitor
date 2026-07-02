# Contributing

Community issues and pull requests are welcome. Please keep reports and code
examples free of tenant IDs, client IDs, client secrets, Resend API keys,
recipient lists, Healthchecks URLs, and private organization names.

## Local Development

```sh
corepack enable
pnpm install
cp .env.example .env.local
pnpm exec tsx --env-file=.env.local src/run.ts
```

The monitor reads ordinary environment variables. Use `.env.local`, GitHub
Actions secrets, or any secret manager that injects process environment values.

## Checks

Run the same gate used by pull requests:

```sh
pnpm verify
docker build -t entra-credential-monitor:local .
```

For targeted work:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Pull Requests

- Keep changes scoped to the behavior being changed.
- Add or update tests for validation, parsing, rendering, or monitoring logic.
- Update README/docs when an operator-facing command, variable, or workflow
  changes.
- Do not commit real `.env` files, customer details, secret-manager references,
  or screenshots containing private tenant data.

## Dependency Updates

Renovate keeps npm dependencies, GitHub Actions, Docker base images, and
container actions current. Patch, pin, and digest updates may automerge after CI
passes. Minor updates are grouped for review, and major updates require
dependency-dashboard approval.

# Contributing to Healthy-Stellar-backend

Thanks for contributing to the Healthy-Stellar backend — a NestJS service for a
decentralized healthcare system built on Stellar Soroban smart contracts.
This guide covers how to set up the project, the conventions we follow, and
how to get a change merged.

## Getting started

1. Install dependencies: `npm install`
2. Copy environment variables: `cp .env.example .env`
3. Run database migrations: `npm run migration:run`
4. (Optional) Seed test data: `npm run seed`
5. Start the dev server: `npm run start:dev`

See the [README](README.md) for the full local setup, including the Docker
Compose workflow and configuration reference.

## Branching

Create a feature branch off `main` using:

```
<type>/<issue-number>-<short-description>
```

Where `<type>` is one of `feature`, `fix`, `chore`, or `docs`. Examples:

```
feature/142-fix-payment-reconciliation
fix/799-stellar-retry-stub
docs/789-contributing-changelog
```

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<body: what changed and why>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Example:

```
fix(billing,stellar): close payment race conditions and dead-letter retry stub
```

## Making a change

- Preserve existing architecture, naming conventions, and coding patterns in
  the module you're touching — check for a similar service/controller/entity
  nearby before introducing a new pattern.
- Add or update tests alongside any behavioral change (see [Testing](#testing)).
- If your change touches `src/migrations/`, read
  [`src/operator-runbook/migration-safety.md`](src/operator-runbook/migration-safety.md)
  first — the `Migration Safety Gate` CI workflow blocks destructive
  migrations (dropped columns/tables, unique index removals, `NOT NULL`
  without a default) unless the PR is labeled `migration-reviewed`.
- Update [`CHANGELOG.md`](CHANGELOG.md) under `[Unreleased]` for any
  user-visible or API-visible change, and especially for anything affecting
  `packages/sdk` consumers.
- Public HTTP endpoints should carry Swagger decorators (`@ApiTags`,
  `@ApiOperation`, `@ApiResponse`, etc.) — see any controller under
  `src/*/controllers/` for the expected shape. Endpoints without them won't
  render in the Swagger UI at `/api`.

## Code style

- Lint: `npx eslint .`
- Format: `npx prettier --check .` (`--write` to fix)
- TypeScript: `npx tsc --noEmit`

## Testing

```bash
npm run test          # unit tests
npm run test:e2e      # end-to-end tests
npm run test:cov      # unit tests with coverage
npm run test:compliance
```

Coverage thresholds are enforced globally and, more strictly, for
patient-data-critical modules (`src/patients`, `src/medical-records`,
`src/records`, `src/audit`) — see `jest.config.js`.

## packages/sdk

`packages/sdk` is an auto-generated TypeScript client (`npm run generate:sdk`)
published to npm on `v*` tags via `.github/workflows/publish-sdk.yml`. Any PR
touching `packages/sdk/**` triggers a dry-run publish/build/test check. Note
SDK-facing changes in `CHANGELOG.md` so consumers can track them between
releases.

## Opening a pull request

- Target `main`.
- Reference the issue you're closing (e.g. `Closes #142`).
- Describe what changed and how you validated it (tests run, manual checks).
- Keep PRs scoped to the issue(s) they resolve — avoid bundling unrelated
  changes.

## Reporting bugs / requesting features

Open a GitHub issue describing the problem or proposal, including
reproduction steps for bugs where applicable.

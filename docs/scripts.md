# Scripts Reference

All scripts are run with `npm run <script>`. Prerequisites are noted for each.

> **Legend**
> - ⚠️ **Destructive** — modifies or deletes data; confirm before running
> - 🚀 **Production-only** — should only run against production infrastructure
> - 🔑 **Requires secrets** — needs env vars beyond `DB_*`/`REDIS_*`
> - 🐳 **Requires Docker** — spins up or connects to containerised services
> - 📦 **Requires k6** — install from https://k6.io/docs/getting-started/installation/
> - ⛓️ **Requires Stellar testnet** — needs `STELLAR_SECRET_KEY` + network access

---

## Core application

| Script | Description |
|---|---|
| `build` | Compile TypeScript to `dist/` via `nest build` |
| `start` | Start the compiled app (no watch) |
| `start:dev` | Start the API with hot-reload (`nest start --watch`) — the normal dev command |
| `start:debug` | Start with Node inspector attached on the default debug port |
| `start:prod` | Run the pre-compiled binary (`node dist/main`) — use in containers 🚀 |
| `start:worker` | Start the BullMQ worker process with hot-reload |
| `start:worker:dev` | Worker with hot-reload (alias for development) |
| `start:worker:prod` | Run the pre-compiled worker binary (`node dist/worker`) 🚀 |

---

## Testing

| Script | Description | Prerequisites |
|---|---|---|
| `test` | Run unit test suite once | — |
| `test:watch` | Unit tests in watch mode | — |
| `test:cov` | Unit tests with Istanbul coverage report | — |
| `test:debug` | Unit tests with Node inspector attached | — |
| `test:unit` | Alias for `test` | — |
| `test:unit:watch` | Alias for `test:watch` | — |
| `test:unit:cov` | Alias for `test:cov` | — |
| `test:e2e` | End-to-end tests (runs in band) | Docker (PostgreSQL container) 🐳 |
| `test:e2e:watch` | E2E tests in watch mode | Docker 🐳 |
| `test:all` | Unit + E2E in sequence | Docker 🐳 |
| `test:all:cov` | Unit + E2E with full coverage report | Docker 🐳 |
| `test:i18n` | Validate that all i18n translation keys are present | — |
| `test:compliance` | HIPAA / GDPR compliance-specific test suite | — |
| `test:performance` | Performance micro-benchmarks (runs in band) | — |
| `test:sdk` | SDK package unit tests | `packages/sdk` built |

---

## Database & migrations

> All migration commands require a running PostgreSQL instance and correct `DB_*` env vars.

| Script | Description | ⚠️ |
|---|---|---|
| `typeorm` | Raw TypeORM CLI passthrough — append subcommands manually | — |
| `migration:generate -- src/migrations/MyMigration` | Diff the current schema against entities and write a new migration file | — |
| `migration:run` | Apply all pending migrations in order | ⚠️ Modifies schema |
| `migration:revert` | Roll back the most recently applied migration | ⚠️ Destructive — test on a DB copy first |
| `seed` | Run the main seeder (development reference data) | ⚠️ Inserts data |
| `seed:test` | Seed a minimal dataset suitable for automated tests | ⚠️ Inserts data |
| `seed:clear` | ⚠️ Delete all seeded rows from the database | ⚠️⚠️ Wipes data |
| `check:migrations` | Dry-run safety check — detects destructive DDL before applying | — |
| `projection:rebuild` | Replay the event-store and rebuild all CQRS read-model projections | ⚠️ Rewrites projection tables; safe to re-run |
| `benchmark:db` | Run database performance benchmarks and print results | Requires populated DB |
| `explain:queries` | Generate `EXPLAIN ANALYZE` output for critical query paths | Requires populated DB |

### migration:revert guidance

`migration:revert` undoes the **last** applied migration. It is safe on development databases. In staging/production:
1. Take a snapshot / point-in-time backup first.
2. Set `CONFIRM_PRODUCTION_MIGRATION=yes` in your shell.
3. Run `npm run migration:revert`.
4. Notify the team via `MIGRATION_SLACK_WEBHOOK_URL`.

---

## Load testing

> Requires **k6** (`brew install k6` / `choco install k6` / https://k6.io) and a running API.  
> Results are written to `load-tests/results/`. See `load-tests/QUICK_START.md` for details.

| Script | Description | Notes |
|---|---|---|
| `load-test` | Full production load test + CI gate check | 📦 |
| `load-test:ci` | Same as above — intended for CI pipelines | 📦 |
| `load-test:production` | Production scenario without the gate | 📦 🚀 |
| `load-test:patient-reads` | Scenario: concurrent patient record reads | 📦 |
| `load-test:provider-writes` | Scenario: concurrent provider record writes | 📦 |
| `load-test:health-checks` | Flood `GET /health` to baseline infrastructure overhead | 📦 |
| `load-test:spike` | Sudden spike to 10× normal load then drop back | 📦 |
| `load-test:gate` | Run only the CI gate check against existing results JSON | 📦 |
| `load-test:smoke` | Minimal smoke run (a few VUs, 1 min) | 📦 |
| `load-test:load` | Sustained load run at expected peak concurrency | 📦 |
| `load-test:stress` | Ramp past peak to find the breaking point | 📦 |
| `load-test:soak` | Long-duration run (hours) to detect memory / connection leaks | 📦 |
| `load-test:auth` | Auth flow only (login, token refresh, logout) | 📦 |
| `load-test:upload` | Record upload scenario | 📦 |
| `load-test:fetch` | Record fetch scenario | 📦 |
| `load-test:access` | Access-control grant/revoke scenario | 📦 |
| `load-test:subscriptions` | GraphQL WebSocket subscription load test | 📦 |
| `load-test:baseline` | Run load scenario and **save result as new baseline** | 📦 ⚠️ Overwrites baseline |
| `load-test:compare` | Run load scenario and compare against saved baseline | 📦 |

---

## Code generation & SDK

| Script | Description | Prerequisites |
|---|---|---|
| `generate:sdk` | Regenerate the TypeScript SDK from the OpenAPI spec (`packages/sdk`) | App must be running to export spec |
| `build:sdk` | Build the SDK package to `packages/sdk/dist/` | `generate:sdk` run first |
| `check:sdk-drift` | Fail if the committed SDK is out of sync with the current spec | — |
| `export:schema` | Export the GraphQL schema to `schema.graphql` | DB connection |
| `generate:graphql-types` | Regenerate TypeScript types from `schema.graphql` via graphql-codegen | `export:schema` run first |
| `generate:contract-types` | Generate TypeScript bindings from the Soroban contract ABI | ⛓️ |
| `check:contract-types` | Fail CI if generated contract types are stale | ⛓️ |
| `docs:generate` | Export OpenAPI JSON to `docs/openapi.json` | App must be running |
| `publish:sdk` | 🚀 Publish `packages/sdk` to npm | 🔑 `NODE_AUTH_TOKEN` env var (npm token); run from CI only |
| `version:sdk` | Bump SDK version in `packages/sdk/package.json` | — |

### publish:sdk guidance

`publish:sdk` pushes a public package to the npm registry.  
**Only run from the release CI workflow** (`.github/workflows/security.yml`).  
Requires the `NODE_AUTH_TOKEN` secret set to a scoped npm publish token.  
Never run manually from a developer machine against production.

---

## Code quality & safety

| Script | Description |
|---|---|
| `check:circular` | Detect circular imports in `src/` using `madge` |
| `check:migrations` | Detect destructive DDL in pending migration files |

---

## Registering GraphQL queries (internal tooling)

| Script | Description |
|---|---|
| `register:graphql-queries` | (If present) register persisted GraphQL queries with the gateway |

---

## Quick-start for new contributors

```bash
# 1. Start dependencies
docker compose -f docker-compose.local.yml up -d

# 2. Apply migrations
npm run migration:run

# 3. Seed development data
npm run seed

# 4. Start API with hot-reload
npm run start:dev
```

# Deployment Guide

This document describes how to deploy the application to production: prerequisites, building the image, required configuration, database migrations, running the API and worker processes, health checks, scaling caveats, and the release/rollback checklist.

For operational procedures (incident response, backups, restores, on-call), see the [runbooks index](./runbooks/README.md).

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Building the Image](#building-the-image)
3. [Required Environment Variables and Secrets](#required-environment-variables-and-secrets)
4. [The `generate-secrets.sh` Script](#the-generatesecretssh-script)
5. [The `deploy.sh` Script](#the-deploysh-script)
6. [Database Migrations](#database-migrations)
7. [Starting the API and Worker](#starting-the-api-and-worker)
8. [Health Checks](#health-checks)
9. [Scaling and Multi-Instance Caveats](#scaling-and-multi-instance-caveats)
10. [Network, TLS, and Reverse Proxy](#network-tls-and-reverse-proxy)
11. [Release Checklist](#release-checklist)
12. [Rollback Checklist](#rollback-checklist)

---

## Prerequisites

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 22.x | Matches the `Dockerfile` base image. |
| pnpm | 9.x | Package manager used by the repo. |
| PostgreSQL | 15.x | Primary datastore. |
| Redis | 7.x | Required by BullMQ for the worker and queue-backed features. |
| Docker | 24+ | Only needed if you build/run via the container image. |

You also need:

- A reachable PostgreSQL instance with a dedicated application role.
- A reachable Redis instance (with persistence enabled if you rely on queued jobs surviving restarts).
- A KMS provider (see [secrets](#required-environment-variables-and-secrets)).
- TLS termination in front of the API (see [Network](#network-tls-and-reverse-proxy)).

---

## Building the Image

The repo ships a production `Dockerfile` and a `docker-compose.yml` that defines two services: `app` (the API) and `worker` (the BullMQ worker). Both are built from the same image and differ only in the command they run.

Build the image:

```bash
docker build -t app:latest .
```

Or, using Compose:

```bash
docker compose build
```

The image runs `npm run build` (TypeScript → `dist/`) at build time. The resulting artifacts are:

- `dist/main` — the HTTP API entrypoint.
- `dist/worker` — the BullMQ worker entrypoint.

The production containerization module lives under `src/dockerfile-and-docker-compose-for-production-ready-containerization/`; consult it for the exact build stages and runtime user if you need to customize the image.

---

## Required Environment Variables and Secrets

Set `NODE_ENV=production`. The following variables are **mandatory** in production. Missing or malformed values should cause the process to fail fast at startup.

### Core

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Must be `production`. |
| `PORT` | HTTP port the API listens on (e.g. `3000`). |
| `DATABASE_URL` | PostgreSQL connection string (or the discrete `DB_*` variables the config expects). |
| `REDIS_URL` | Redis connection string used by BullMQ. |
| `CORS_ORIGINS` | Comma-separated list of allowed browser origins. Do **not** use `*` in production. |
| `TRUST_PROXY` | Set to the number of proxy hops (e.g. `1`) or a trusted CIDR list. See [Network](#network-tls-and-reverse-proxy). |

### Authentication & Crypto

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Signing secret for access tokens. |
| `JWT_REFRESH_SECRET` | Signing secret for refresh tokens. |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes. |
| `KMS_PROVIDER` | KMS backend (e.g. `aws`, `gcp`, `local`). |
| `KMS_KEY_ID` | Key identifier/ARN used for envelope encryption. |
| `KMS_*` | Provider-specific credentials (region, endpoint, etc.). |

### Stellar / Soroban

| Variable | Description |
|----------|-------------|
| `STELLAR_NETWORK` | `public` or `testnet`. |
| `STELLAR_HORIZON_URL` | Horizon endpoint. |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint. |
| `STELLAR_SOURCE_SECRET` | Secret key for the account that submits Soroban transactions. Treat as highly sensitive. |

### Webhooks

| Variable | Description |
|----------|-------------|
| `WEBHOOK_SIGNING_SECRET` | HMAC secret used to sign outbound webhooks. |
| `WEBHOOK_VERIFY_SECRET` | Secret used to verify inbound webhook callbacks. |

### Migration Backup (optional but recommended)

| Variable | Description |
|----------|-------------|
| `MIGRATION_BACKUP_ENABLED` | Enable a pre-migration backup. |
| `MIGRATION_BACKUP_DIR` | Directory where the backup is written. |
| `MIGRATION_BACKUP_RETENTION_DAYS` | How long to keep migration backups. |

See [Database Migrations](#database-migrations) for how these interact with `migration:run`.

> **Never commit secrets.** Inject them via your platform's secret manager or a mounted secrets directory (see below).

---

## The `generate-secrets.sh` Script

`generate-secrets.sh` generates strong random values for the secrets the app needs and writes them into a local `./secrets` directory (one file per secret). It is intended for **local/staging bootstrap and as a template** — in production you should source secrets from your platform's secret manager rather than from generated files on disk.

What it produces (typical):

- `jwt_secret` and `jwt_refresh_secret`
- `webhook_signing_secret` and `webhook_verify_secret`
- placeholder entries for KMS and Stellar/Soroban keys that you must fill in with real values

Run it once:

```bash
./generate-secrets.sh
```

`deploy.sh` expects this directory at `./secrets` (relative to the repo root). If you manage secrets externally, mount them at `./secrets` or adjust `deploy.sh` accordingly.

> If your organization has standardized on an external secret manager, `generate-secrets.sh` can be considered a bootstrap convenience only — do not use its output as the production source of truth.

---

## The `deploy.sh` Script

`deploy.sh` is a thin orchestration wrapper. It:

1. Verifies that `./secrets` exists and contains the mandatory secret files.
2. Builds (or pulls) the image.
3. Runs database migrations (`npm run migration:run`) against the target database.
4. Starts the `app` and `worker` services (via `docker compose up -d` or your process manager).

It is a convenience for single-host / Compose deployments. For orchestrated platforms (Kubernetes, ECS, etc.) you will typically replicate these steps in your pipeline rather than calling `deploy.sh` directly. In that case, treat `deploy.sh` as documentation of the required order of operations.

> If you do not use `deploy.sh`, ensure your pipeline performs the same steps in the same order — especially running migrations **before** rolling out new app/worker containers.

---

## Database Migrations

**Migrations do not run automatically.** `src/config/database.config.ts` sets `migrationsRun: false`, so the application will **not** apply pending migrations on startup. You must run them explicitly as part of every release.

### Running migrations

Before rolling out new API/worker containers, run:

```bash
npm run migration:run
```

(In a container: `docker compose run --rm app npm run migration:run`, or the equivalent one-off task on your platform.)

Run migrations **once per release**, from a single process — not from every replica. Running them concurrently from multiple instances can cause lock contention or partial failures.

### Checking for pending migrations

Use the check script in CI to fail the build if the schema is out of date:

```bash
npm run check:migrations
```

This verifies that there are no unapplied migrations and that the code's expected schema matches the database. Wire it into your pipeline as a gate before deployment.

### Migration backups (`MIGRATION_BACKUP_*`)

When `MIGRATION_BACKUP_ENABLED=true`, the migration tooling takes a backup of the database (or the affected schema) into `MIGRATION_BACKUP_DIR` before applying migrations, and prunes backups older than `MIGRATION_BACKUP_RETENTION_DAYS`. This gives you a fast restore point if a migration misbehaves.

- Backups are written to `MIGRATION_BACKUP_DIR`; ensure that path is on durable storage with enough free space.
- The backup step runs as part of `migration:run`, so it must be enabled on the host/container that runs migrations.
- For large databases, backups can be slow — factor this into your release window.

### Order of operations

1. `npm run check:migrations` (CI gate).
2. Take/verify a backup (automatic if `MIGRATION_BACKUP_ENABLED=true`).
3. `npm run migration:run`.
4. Roll out new API and worker containers.

---

## Starting the API and Worker

Two long-running processes must run in production:

| Process | Entrypoint | Responsibility |
|---------|------------|----------------|
| API | `node dist/main` | HTTP server, request handling, synchronous work. |
| Worker | `node dist/worker` | BullMQ consumers and background jobs. |

Both are built from the same image; only the command differs. In `docker-compose.yml` these are the `app` and `worker` services respectively.

### Which jobs live where

- **API (`dist/main`):** request/response handling, authentication, and any work that must complete within a request. It also enqueues background jobs onto BullMQ queues.
- **Worker (`dist/worker`):** consumes BullMQ queues — e.g. webhook delivery, Stellar/Soroban transaction submission and confirmation, notification dispatch, and other asynchronous jobs. The worker does **not** serve HTTP.

Because the worker is a separate process, **the API and worker can be scaled independently**. Scale the API for request throughput and the worker for queue depth/latency. See the scaling caveats below before increasing replica counts.

---

## Health Checks

The API exposes two health endpoints:

| Endpoint | Purpose | Expected |
|----------|---------|----------|
| `GET /health` | **Liveness** — is the process up? | `200` when the process is running. |
| `GET /health/ready` | **Readiness** — can it serve traffic? | `200` only when dependencies (DB, Redis, etc.) are reachable. |

Configure your orchestrator/load balancer accordingly:

- **Liveness probe** → `/health`. Restart the container if this fails repeatedly.
- **Readiness probe** → `/health/ready`. Remove the instance from the load balancer while it fails, and only route traffic once it passes.

The worker has no HTTP endpoint; monitor it via its logs and process liveness (e.g. container restart policy or a process supervisor).

---

## Scaling and Multi-Instance Caveats

You can run more than one API replica and more than one worker replica, but **several services use in-process `setInterval`/cron sweeps that will run on every replica**. Running multiple replicas without addressing this causes duplicate work, duplicate notifications, and race conditions.

Known in-process sweeps include (non-exhaustive):

- `BreakGlassService` — periodic sweep of break-glass access.
- Session cleanup — periodic removal of expired sessions.
- Missed-dose detection — periodic scan for missed doses.

### What to do

For each in-process sweep, choose one of:

1. **Disable it on all but one replica** via a feature flag / env var, and run a dedicated "scheduler" instance (a single replica with the sweep enabled).
2. **Leader election** — have replicas coordinate so only the leader runs the sweep (e.g. via a Redis lock or a database advisory lock).

Do **not** simply scale replicas without addressing these sweeps. If you are unsure which sweeps are active in your build, audit for `setInterval`, `@Cron`, and similar scheduling before scaling beyond one replica.

Queue-based work (BullMQ) is safe to scale horizontally — BullMQ ensures each job is processed by a single worker.

---

## Network, TLS, and Reverse Proxy

- **TLS termination:** Terminate TLS at your load balancer or reverse proxy (nginx, ALB, etc.). The app itself serves plain HTTP behind the proxy.
- **`trust proxy`:** Because the app sits behind a proxy, configure Express `trust proxy` so that client IPs and protocol are read correctly from `X-Forwarded-*` headers. Set `TRUST_PROXY` to the number of proxy hops (commonly `1`) or a trusted CIDR list. Do **not** set it to `true` blindly — that trusts any client-supplied header.
- **CORS origins:** Set `CORS_ORIGINS` to the exact browser origins that should be allowed. Never use `*` in production. Include scheme and host (and port if non-default).
- **Forwarded headers:** Ensure your proxy sets `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host`.

---

## Release Checklist

Zero-downtime release:

1. **CI gate:** `npm run check:migrations` passes.
2. **Backup:** confirm `MIGRATION_BACKUP_ENABLED=true` (or take a manual backup) and that `MIGRATION_BACKUP_DIR` has space.
3. **Migrate:** run `npm run migration:run` once, from a single process.
4. **Build/publish** the new image.
5. **Roll out the worker** (new worker replicas can start consuming; ensure jobs are backward-compatible with the new schema).
6. **Roll out the API** gradually (rolling update). New instances must pass `/health/ready` before receiving traffic; old instances drain and are removed.
7. **Verify:** `/health` and `/health/ready` return `200`; check logs for errors; confirm queue depth is draining.
8. **Post-release:** monitor error rates and latency for the agreed window.

> Migrations must be **backward compatible** with the previous app version so that old and new instances can run side-by-side during the rollout (expand/contract pattern: add columns/tables first, remove in a later release).

---

## Rollback Checklist

1. **Stop the rollout** and route traffic back to the previous known-good version (redeploy the previous image tag).
2. **Revert the last migration** if the release included a schema change that is incompatible with the previous version:

   ```bash
   npm run migration:revert
   ```

   `migration:revert` reverts the **most recent** migration. If a release included multiple migrations, run it once per migration, in reverse order, until you reach the previous release's schema.
3. **Restore from backup** if a revert is not possible or the data is corrupted. Use the backup produced by `MIGRATION_BACKUP_*` (or your regular backup — see `docker/backup/backup.sh` and the [runbooks](./runbooks/README.md)).
4. **Verify** `/health` and `/health/ready` return `200` and that the worker is consuming queues.
5. **Post-incident:** record what happened and update this document / the runbooks.

> Prefer forward-fixes over reverts when possible. Reverting a migration that has already written data can lose data — always confirm with the backup before reverting a destructive migration.

---

## Related Documentation

- [Runbooks index](./runbooks/README.md) — incident response, backups, restores, on-call procedures.
- `Dockerfile` — production image build.
- `docker-compose.yml` — `app` and `worker` service definitions.
- `deploy.sh` — single-host/Compose deployment wrapper.
- `generate-secrets.sh` — local/staging secret bootstrap.
- `docker/backup/backup.sh` — database backup script.
- `src/config/database.config.ts` — database and migration configuration (`migrationsRun: false`).
- `src/worker.ts` — BullMQ worker entrypoint.
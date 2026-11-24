# Healthcare Backend

A production-grade healthcare backend built with NestJS, PostgreSQL, Redis, and Stellar.

## Deployment

### Single-scheduler requirement (distributed cron locking)

This application schedules background work with `@Cron` decorators (subscription
renewals, appointment reminders, notification digests, compliance reports, backups,
escalations, cleanups, and more). When the API runs with more than one replica, every
replica would otherwise execute every scheduled job, producing duplicate charges,
emails, reports, and concurrent `pg_dump`s.

To prevent this, scheduled jobs are guarded by a shared `@WithDistributedLock()`
decorator backed by `RedisLockService`. Each job acquires a Redis lock keyed by the
job name and the current tick before running; replicas that fail to acquire the lock
skip that tick. Lock acquisition failures are logged and treated as a skip rather
than a crash.

Operational requirements:

- A shared Redis instance MUST be reachable by all replicas so the lock is visible
  cluster-wide. Do not run replicas against isolated Redis instances.
- Keep replica clocks reasonably synchronized (NTP) so tick keys align.
- If you prefer a dedicated scheduler process, run exactly one replica with
  `SCHEDULER_ENABLED=true` and set it to `false` on the others; the distributed lock
  remains a safety net for rolling deploys and misconfiguration.

## Getting Started

**Prerequisites:** Node.js v18+ and PostgreSQL v12+.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and configure the required values.
3. Run database migrations with `npm run migration:run`.
4. Start the API with `npm run start:dev`.
5. In a separate terminal, start the background worker with `npm run start:worker:dev`.

Run `npm run seed` only when you want to populate a development database with sample data.

## Scripts Reference

The project has 66 npm scripts. A full reference — including descriptions, prerequisites, and safety warnings for destructive scripts — is in **[docs/scripts.md](docs/scripts.md)**.

Quick-start summary:

```bash
npm run start:dev          # API with hot-reload
npm run migration:run      # apply pending DB migrations
npm run seed               # load development reference data
npm run test               # unit tests
npm run test:e2e           # end-to-end tests (requires Docker)
npm run load-test:ci       # k6 load test + CI gate (requires k6)
npm run build:sdk          # build the TypeScript client SDK
```

---

## Configuration

### Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

`.env.example` is the authoritative reference for every environment variable the application reads. Variables are grouped by area and annotated with:

- `[REQUIRED]` — must be set before the app starts in production
- `[OPTIONAL]` — has a safe default; override only when needed
- `[SECRET]` — never commit the real value; use a secrets manager in production

**Key sections in `.env.example`:**

| Section | Variables |
|---|---|
| Application | `NODE_ENV`, `PORT`, `API_URL`, `APP_BASE_URL` |
| Database (primary) | `DATABASE_URL` / `DB_HOST` … `DB_POOL_MAX` |
| Database (read replica) | `DB_REPLICA_HOST` … `DB_REPLICA_POOL_MAX` |
| Redis | `REDIS_URL` / `REDIS_HOST` … `REDIS_DB` |
| JWT & Auth | `JWT_SECRET`, `JWT_EXPIRATION`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRATION` |
| Encryption / KMS | `ENCRYPTION_MASTER_KEY`, `MASTER_KEY`, `KMS_ENABLED`, `AWS_*` |
| Stellar / Soroban | `STELLAR_SECRET_KEY`, `STELLAR_CONTRACT_ID`, `SOROBAN_RPC_URL` |
| IPFS | `IPFS_NODE_URL`, `IPFS_GATEWAY`, `IPFS_FALLBACK_GATEWAY` |
| Email / SMTP | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM_ADDRESS` |
| Telemedicine | `TELEMEDICINE_SIGNALING_URL`, `TELEMEDICINE_TOKEN_SECRET` |
| Research export | `RESEARCH_EXPORT_BUCKET`, `RESEARCH_K_ANONYMITY` |
| EHR import | `EHR_IMPORT_S3_BUCKET`, `EHR_IMPORT_MAX_RETRIES` |
| GraphQL subscriptions | `SUBSCRIPTIONS_IDLE_TIMEOUT_MS`, `SUBSCRIPTIONS_MAX_PER_CONNECTION` |
| Ops / alerting | `OPS_SLACK_WEBHOOK_URL`, `QUEUE_DEPTH_THRESHOLD` |
| Migrations | `MIGRATION_EXECUTOR`, `CONFIRM_PRODUCTION_MIGRATION` |

## Security Headers

The API applies the shared Helmet configuration once through `applySecurityHeaders()` in `src/security/http-security.config.ts`.

**Prerequisites:** Node.js v18+, PostgreSQL v12+

1. Install dependencies:
   `npm install`
2. Set up environment variables:
   `cp .env.example .env`
3. Run database migrations:
   `npm run migration:run`
4. **Seed the database with test data:**
   `npm run seed`
   _(Why added: This generates fake users, medical records, and access grants via `src/database/seeder.ts` so you can log in and test the application)._
5. Start the development server:
   `npm run start:dev`
6. Start the background job worker process:
   `npm run start:worker:dev`

## Configuration

Copy `.env.example` to `.env`. Key sections:

### Data residency and multi-region routing

The backend supports region-aware tenant database routing across four regions: **EU**, **US**, **APAC**, and **AFRICA**. Each tenant declares a residency region and, when `strictDataResidency` is enabled, requests are rejected with `403 Forbidden` if they attempt to access data outside the configured region.

Each region has its own set of environment variables for database, Stellar Horizon, and IPFS configuration:

| Variable                     | Region | Description                                           | Default                                |
| ---------------------------- | ------ | ----------------------------------------------------- | -------------------------------------- |
| `DEFAULT_REGION`             | global | Default region for new tenants                        | `EU`                                   |
| `DB_TYPE_EU`                 | EU     | Database type                                         | `postgres`                             |
| `DB_HOST_EU`                 | EU     | Database host                                         | —                                      |
| `DB_PORT_EU`                 | EU     | Database port                                         | `5432`                                 |
| `DB_NAME_EU`                 | EU     | Database name                                         | `healthy_stellar_eu`                   |
| `EU_DB_URL`                  | EU     | Database connection URL (overrides individual params) | —                                      |
| `DB_URL_EU`                  | EU     | Fallback database URL                                 | —                                      |
| `STELLAR_HORIZON_EU_URL`     | EU     | Stellar Horizon endpoint                              | `https://horizon.eu.stellar.org`       |
| `IPFS_NODES_EU`              | EU     | Comma-separated IPFS node URLs                        | `https://ipfs-eu-1.infura.io:5001`     |
| `DB_TYPE_US`                 | US     | Database type                                         | `postgres`                             |
| `DB_HOST_US`                 | US     | Database host                                         | —                                      |
| `DB_PORT_US`                 | US     | Database port                                         | `5432`                                 |
| `DB_NAME_US`                 | US     | Database name                                         | `healthy_stellar_us`                   |
| `US_DB_URL`                  | US     | Database connection URL (overrides individual params) | —                                      |
| `DB_URL_US`                  | US     | Fallback database URL                                 | —                                      |
| `STELLAR_HORIZON_US_URL`     | US     | Stellar Horizon endpoint                              | `https://horizon.us.stellar.org`       |
| `IPFS_NODES_US`              | US     | Comma-separated IPFS node URLs                        | `https://ipfs-us-1.infura.io:5001`     |
| `DB_TYPE_APAC`               | APAC   | Database type                                         | `postgres`                             |
| `DB_HOST_APAC`               | APAC   | Database host                                         | —                                      |
| `DB_PORT_APAC`               | APAC   | Database port                                         | `5432`                                 |
| `DB_NAME_APAC`               | APAC   | Database name                                         | `healthy_stellar_apac`                 |
| `APAC_DB_URL`                | APAC   | Database connection URL (overrides individual params) | —                                      |
| `DB_URL_APAC`                | APAC   | Fallback database URL                                 | —                                      |
| `STELLAR_HORIZON_APAC_URL`   | APAC   | Stellar Horizon endpoint                              | `https://horizon.apac.stellar.org`     |
| `IPFS_NODES_APAC`            | APAC   | Comma-separated IPFS node URLs                        | `https://ipfs-apac-1.infura.io:5001`   |
| `DB_TYPE_AFRICA`             | AFRICA | Database type                                         | `postgres`                             |
| `DB_HOST_AFRICA`             | AFRICA | Database host                                         | —                                      |
| `DB_PORT_AFRICA`             | AFRICA | Database port                                         | `5432`                                 |
| `DB_NAME_AFRICA`             | AFRICA | Database name                                         | `healthy_stellar_africa`               |
| `AFRICA_DB_URL`              | AFRICA | Database connection URL (overrides individual params) | —                                      |
| `DB_URL_AFRICA`              | AFRICA | Fallback database URL                                 | —                                      |
| `STELLAR_HORIZON_AFRICA_URL` | AFRICA | Stellar Horizon endpoint                              | `https://horizon.africa.stellar.org`   |
| `IPFS_NODES_AFRICA`          | AFRICA | Comma-separated IPFS node URLs                        | `https://ipfs-africa-1.infura.io:5001` |

Example configuration:

```bash
DEFAULT_REGION=EU
DB_HOST_EU=postgres-eu.internal.example.com
DB_PORT_EU=5432
DB_NAME_EU=healthy_stellar_eu
STELLAR_HORIZON_EU_URL=https://horizon.eu.stellar.org
IPFS_NODES_EU=https://ipfs-eu-1.infura.io:5001

DB_HOST_US=postgres-us.internal.example.com
DB_PORT_US=5432
DB_NAME_US=healthy_stellar_us
STELLAR_HORIZON_US_URL=https://horizon.us.stellar.org
IPFS_NODES_US=https://ipfs-us-1.infura.io:5001

DB_HOST_APAC=postgres-apac.internal.example.com
DB_PORT_APAC=5432
DB_NAME_APAC=healthy_stellar_apac
STELLAR_HORIZON_APAC_URL=https://horizon.apac.stellar.org
IPFS_NODES_APAC=https://ipfs-apac-1.infura.io:5001

DB_HOST_AFRICA=postgres-africa.internal.example.com
DB_PORT_AFRICA=5432
DB_NAME_AFRICA=healthy_stellar_africa
STELLAR_HORIZON_AFRICA_URL=https://horizon.africa.stellar.org
IPFS_NODES_AFRICA=https://ipfs-africa-1.infura.io:5001
```

Tenant example:

```json
{
  "region": "EU",
  "strictDataResidency": true
}
```

When a policy violation occurs, the API returns:

```text
403 Forbidden
Tenant data residency policy prohibits access outside the configured region.
```

For local development, the routing service initializes SQLite-backed regional datasources so tests and simulations can verify region selection without a full multi-database deployment.

| Section            | Variables                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Core               | `NODE_ENV`, `PORT`, `APP_URL`, `APP_DOMAIN`                                                                               |
| Database           | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`                                                             |
| Encryption / PHI   | `ENCRYPTION_KEY`, `PHI_ENCRYPTION_KEY`                                                                                    |
| JWT & Auth         | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRATION`, `SESSION_SECRET` |
| CORS & Security    | `ALLOWED_ORIGINS`, `CORS_ORIGIN`, `ADMIN_IP_ALLOWLIST`                                                                    |
| Redis              | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`                                                                              |
| Email              | `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`                                                                    |
| Stellar Blockchain | `STELLAR_NETWORK`, `STELLAR_SECRET_KEY`, `STELLAR_CONTRACT_ID`                                                            |
| Data Residency     | `DEFAULT_REGION`, `DB_TYPE_*`, `DB_HOST_*`, `DB_PORT_*`, `DB_NAME_*`, `*_DB_URL`, `STELLAR_HORIZON_*_URL`, `IPFS_NODES_*` |
| IPFS               | `IPFS_HOST`, `IPFS_PORT`, `IPFS_URL`                                                                                      |
| Webhooks           | `IPFS_WEBHOOK_SECRET`, `STELLAR_WEBHOOK_SECRET`, `QUEUE_HMAC_SECRET`                                                      |
| OIDC / SSO         | `OIDC_PROVIDERS`, `OIDC_{PROVIDER}_CLIENT_ID`, …                                                                          |
| Logging            | `LOG_LEVEL`, `LOKI_HOST`                                                                                                  |
| Metrics & Tracing  | `METRICS_TOKEN`, `OTEL_EXPORTER_OTLP_ENDPOINT`                                                                            |
| Backup             | `BACKUP_DIR`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_RETENTION_DAYS`                                                            |
| Feature Flags      | `TELEMEDICINE_ENABLED`, `SURGICAL_MANAGEMENT_ENABLED`                                                                     |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Authentication & Authorization

**There is no global auth guard.** Every controller that must be protected has to opt in explicitly with `@UseGuards(JwtAuthGuard, ...)`; anything without a guard is public. Guards such as `RolesGuard`, `AdminGuard`, `PatientPrivacyGuard` and `MedicalRbacGuard` do **not** authenticate on their own, and decorators like `@RequireAdmin()` and `@HipaaRoles()` only attach metadata — they do nothing unless the matching guard runs.

The authenticated principal attached to the request is:

```ts
{ userId, email, role, mfaEnabled, sessionId, organizationId }
```

There is no `id`, `sub` or `tenantId` field — use `userId` and `organizationId`. `role` is one of the `UserRole` enum values.

The full guide — token issuance and refresh, the guard catalogue (what each guard checks and what it depends on), the valid role list, `@Public()`, API keys, MFA, and SMART scopes — is in **[docs/auth.md](docs/auth.md)**.

Before opening a PR that adds or changes a controller, work through the **new controller security checklist** in [CONTRIBUTING.md](CONTRIBUTING.md#new-controller-security-checklist).

## Security Headers

The API applies the shared Helmet configuration once through `applySecurityHeaders()` in `src/security/http-security.config.ts`:

- `Content-Security-Policy` — defaults to same-origin resources, blocks object embedding and framing, and uses a per-request nonce for scripts. Development additionally allows the Swagger CDN.
- `X-Frame-Options: DENY` — blocks clickjacking through iframes.
- `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing.
- `Strict-Transport-Security` — enables HTTPS-only access with a one-year max age, subdomains, and preload.
- `Referrer-Policy: no-referrer` — suppresses referrer information.
- `X-XSS-Protection: 0` — disables the legacy browser filter; CSP provides the script policy.

## API Endpoints

The complete route reference is available in the [Swagger UI](/api) when the
application is running and in the generated [OpenAPI specification](docs/openapi.json).
The prefixes below summarize the API by domain; URI-versioned endpoints are
normally served under `/v1` (version-neutral routes are not).

- **Access control and roles:** `/access`, `/users`, `/policies`, `/medical-rbac`, `/role-templates`
- **Administration and operations:** `/admin/*`, `/operator/runbooks`
- **Analytics and governance:** `/analytics/*`, `/governance/reports`, `/financial-reports`
- **Appointments:** `/appointments/*`, `/consultations`, `/doctor-availability`
- **Authentication and identity:** `/auth/*`, `/oauth2`, `/providers`
- **Backup and recovery:** `/backup`
- **Beds, departments, and wards:** `/bed-occupancy`, `/beds`, `/departments`, `/wards`
- **Billing and insurance:** `/billing/*`, `/claims`, `/denials`, `/appeals`, `/insurance`, `/medical-codes`, `/payments`, `/subscriptions`
- **Clinical records:** `/medical-records`, `/clinical-notes`, `/clinical-templates`, `/consents`, `/attachments`
- **Clinical workflow:** `/diagnosis`, `/treatment-plans`, `/procedures`, `/care-templates`, `/outcomes`, `/decision-support`
- **Data governance and validation:** `/api/v1/data-residency`, `/gdpr`, `/research-export`, `/medical-validation`, `/admin/tenants/*/field-validation-rules`
- **EHR import:** `/ehr-import`, `/admin/import`
- **Emergency and incidents:** `/emergency`, `/emergency-medical-info`, `/incidents`
- **FHIR interoperability:** `/fhir/r4`
- **Hospital configuration and registry:** `/hospital-configuration`, `/hospital-registry`
- **Infection control:** `/infection-control`
- **Laboratory:** `/laboratory/*`, `/lab-*`
- **Medical staff:** `/medical-staff`, `/medical-staff/credentials`
- **Medication administration:** `/medication-administration`, `/medication-reconciliation`, `/adverse-reactions`, `/barcode-verification`
- **Monitoring and compliance:** `/health`, `/healthcare-monitoring`, `/clinical-alerts`, `/compliance`, `/dashboard`, `/monitoring`, `/metrics`
- **Notifications:** `/notifications/*`
- **Pathology:** `/pathology/*`
- **Patients and portal:** `/patients`, `/guardians`, `/patient-portal`
- **Pharmacy:** `/pharmacy/*`, `/cds-hooks`
- **Provider-patient coordination:** `/provider-patient/handoffs`
- **Queues and jobs:** `/jobs`, `/dlq`, `/admin/dlq`
- **Reporting:** `/reports`, `/admin/report-schedules`
- **Security and key management:** `/healthcare-security`, `/key-management/kek`, `/admin/key-management`, `/csp-report`, `/admin/api-keys`, `/admin/secret-rotation`
- **Stellar integration:** `/stellar/*`
- **Surgical management:** `/surgical`
- **Telemedicine:** `/telemedicine/*`
- **Tenant management:** `/admin/tenants`, `/admin/tenant-quota`, `/onboarding`
- **Webhooks:** `/webhooks`
- **Platform services:** `/audit`, `/audit-logs`, `/api/versions`, `/consistency`, `/errors`, `/i18n`, `/performance`, `/admin/query-performance`, `/admin/reconciliation`, `/admin/feature-flags`, `/admin/projections`

## Webhooks

Tenants can subscribe to healthcare events (record uploads, access grants, diagnosis
updates, and more). Deliveries are signed with HMAC-SHA256 (`X-Webhook-Signature`),
retried with exponential backoff, replayable from the dead-letter queue, and the
platform also receives signed inbound callbacks from IPFS, Stellar and insurance
payers.

See the [webhook integrator guide](docs/webhooks.md) for the delivery headers,
signature verification snippets (Node and Python), secret rotation semantics, retry
and alerting behaviour, manual replay, the event catalog, and the inbound signing
scheme.

## Postman Collection

Import [`docs/postman/MedChain.postman_collection.json`](docs/postman/MedChain.postman_collection.json). Environments: Local, Testnet, Staging. The collection is generated from OpenAPI; see [how to regenerate the API references](docs/OPENAPI_REGENERATION.md).

## Database Schema

The authoritative database schema is defined by the [TypeORM migrations](src/migrations/)
and corresponding entity definitions in `src/`.

## Multi-Tenancy

How the current tenant is resolved, how schema/region routing and Row-Level
Security work, when a new entity needs a `tenantId`/`organizationId` column, and
how cron and queue jobs must establish tenant context is documented in
**[docs/multi-tenancy.md](docs/multi-tenancy.md)**.

> Never trust the `x-tenant-id` request header for authenticated requests — the
> tenant always comes from the verified JWT. See the doc for details.

## Error Handling

All non-FHIR errors return a consistent envelope (`statusCode`, `error`, `message`, `code`, `traceId`, `timestamp`, `path`, `details`). Clients should branch on the machine-readable `code` — one of the `AppErrorCode` values — rather than on `message` or the HTTP status. `GlobalExceptionFilter` is the effective handler: it maps errors to codes, logs them with a `traceId`, and withholds internal details (stack traces) from responses. Routes under `/fhir` return an HL7 FHIR `OperationOutcome` instead.

See [`docs/errors.md`](docs/errors.md) for the full error-code catalog (HTTP status, meaning, and retryability for every code), the exception-filter order, sanitization rules, and how `traceId` maps to logs and tracing for support requests.

## Testing

See **[docs/scripts.md](docs/scripts.md)** for the full list of test scripts and their prerequisites.

```bash
npm run test          # Unit tests
npm run test:e2e      # End-to-end tests (requires Docker)
npm run test:cov      # Unit-test coverage
npm run test:all:cov  # Unit and end-to-end coverage
npm run test:compliance  # HIPAA/GDPR compliance tests
```

## Deployment

Production runs two processes from the same image: the HTTP API (`dist/main`) and the BullMQ worker (`dist/worker`). Migrations are **not** applied automatically (`migrationsRun: false`), so they must be run explicitly before each release.

```bash
npm ci && npm run build          # build the image / bundle
npm run migration:run            # apply pending migrations (once per release)
npm run start:prod               # API process
npm run start:worker:prod        # worker process (separate container/instance)
```

- Set `NODE_ENV=production` and provide the mandatory secrets (JWT, KMS/encryption, Stellar/Soroban, webhook secrets) — see [docs/deployment.md](docs/deployment.md).
- Liveness: `GET /health`; readiness: `GET /health/ready`.
- The API is served under the global prefix `/api`; Swagger docs are at `/api/docs`.
- Running more than one replica requires disabling or leader-electing the in-process cron sweeps (break-glass, session cleanup, missed-dose detection).

The full guide — prerequisites, image build, required env/secrets, migration and backup env vars, scaling caveats, TLS/reverse-proxy expectations, and the release/rollback checklist — is in **[docs/deployment.md](docs/deployment.md)**. Operator procedures are indexed in [docs/runbooks/README.md](docs/runbooks/README.md).

## Route overview

Routes are grouped by module. Only routes registered in a module's `controllers` array are served; any controller not listed there is not exposed.

- `/auth` — authentication and session management
- `/users` — user accounts and roles
- `/patients` — patient records
- `/appointments` — scheduling
- `/pharmacy` — prescriptions, dispensing, and inventory
- `/laboratory` — lab orders and results
- `/analytics` — reporting and dashboards
- `/integrations` — external system integrations

## Contributing

- Keep controllers registered in a module and protected by `JwtAuthGuard` + `RolesGuard`.
- Derive actor ids from `req.user`, never from request bodies.
- Update this route list whenever a module's registered controllers change.

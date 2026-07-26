# Healthy-Stellar-backend

NestJS backend for a decentralized healthcare system built on Stellar Soroban smart contracts.

## Table of Contents

- [Project Structure](#project-structure)
- [Local Development with Docker](#local-development-with-docker)
- [Background Worker Process](#background-worker-process)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Security Headers](#security-headers)
- [API Endpoints](#api-endpoints)
- [Postman Collection](#postman-collection)
- [Database Schema](#database-schema)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Deployment](#deployment)

## Project Structure

```
src/
├── main.ts
├── app.module.ts
├── config/
│   └── database.config.ts
├── common/
│   └── filters/
│       └── http-exception.filter.ts
└── medical-records/
    ├── medical-records.module.ts
    ├── entities/
    ├── dto/
    ├── services/
    └── controllers/
```

## Local Development with Docker

| Service  | Container   | Port(s)                | Purpose                    |
|----------|-------------|------------------------|----------------------------|
| api      | hs-api      | 3000                   | NestJS app with hot reload |
| worker   | hs-worker   | -                      | BullMQ queue processors    |
| postgres | hs-postgres | 5432                   | PostgreSQL 15              |
| redis    | hs-redis    | 6379                   | Redis 7                    |
| mailhog  | hs-mailhog  | 1025 (SMTP), 8025 (UI) | Local email capture        |

```bash
cp .env.docker .env.docker.local
docker compose -f docker-compose.local.yml up --build
docker compose -f docker-compose.local.yml exec api npm run migration:run
```

- API: http://localhost:3000
- Swagger: http://localhost:3000/api
- MailHog: http://localhost:8025

The `src/` directory is bind-mounted; NestJS runs with `--watch` so changes reload automatically.

```bash
docker compose -f docker-compose.local.yml logs -f api      # Follow API logs
docker compose -f docker-compose.local.yml logs -f worker   # Follow Worker logs
docker compose -f docker-compose.local.yml down             # keep volumes
docker compose -f docker-compose.local.yml down -v          # wipe volumes
```

> `.env.docker` contains placeholder secrets for local use only. Never use outside local dev.

## Background Worker Process

The backend application uses [BullMQ](https://bullmq.io/) for managing and executing background queues. This is essential for offloading heavy operations or interacting with the Stellar blockchain without blocking the main HTTP event loop of the API service.

The worker process is defined in `src/worker.ts` and `src/worker.module.ts`.

### Key Responsibilities
The worker processes tasks from several queues:
- **`contract-writes`**: Schedules and signs write transactions to Stellar Soroban smart contracts.
- **`stellar-transactions`**: Manages blockchain transaction submission and retry logic.
- **`event-indexing`**: Scrapes and indexes events emitted by the smart contracts.
- **`ipfs-uploads`**: Uploads records/PHI hashes to IPFS.
- **`email-notifications`**: Sends transactional and notification emails.
- **`reports`**: Processes PDF/CSV healthcare compliance report generation.
- **`fhir-bulk-export` / `ehr-import`**: Processes FHIR/EHR batch data imports and exports.

### Running the Worker

#### With Docker Compose (Local Dev)
The worker is included in `docker-compose.local.yml` and runs automatically when you spin up the project:
```bash
docker compose -f docker-compose.local.yml up --build
```

#### Bare Metal (Without Docker)
If you run the NestJS API locally using `npm run start:dev`, you **MUST** also start the worker process in a separate terminal:
```bash
npm run start:worker:dev
```
Otherwise, any operations requiring blockchain interactions, event indexing, or email delivery will remain in the Redis queue and will not execute.

## Installation & Setup

**Prerequisites:** Node.js v18+, PostgreSQL v12+

1. Install dependencies:
   `npm install`
2. Set up environment variables:
   `cp .env.example .env`
3. Run database migrations:
   `npm run migration:run`
4. **Seed the database with test data:**
   `npm run seed`
   *(Why added: This generates fake users, medical records, and access grants via `src/database/seeder.ts` so you can log in and test the application).*
5. Start the development server:
   `npm run start:dev`
6. Start the background job worker process:
   `npm run start:worker:dev`

## Configuration

Copy `.env.example` to `.env`. Key sections:

### Data residency and multi-region routing

The backend now supports region-aware tenant database routing. Each tenant can declare a residency region and, when `strictDataResidency` is enabled, requests are rejected with `403 Forbidden` if they attempt to access data outside the configured region.

Example environment variables:

```bash
DEFAULT_REGION=EU
EU_DB_URL=sqlite://eu.sqlite
US_DB_URL=sqlite://us.sqlite
DB_TYPE_EU=sqlite
DB_TYPE_US=sqlite
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

| Section            | Variables                                                      |
|--------------------|----------------------------------------------------------------|
| Core               | `NODE_ENV`, `PORT`, `APP_URL`, `APP_DOMAIN`                   |
| Database           | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` |
| Encryption / PHI   | `ENCRYPTION_KEY`, `PHI_ENCRYPTION_KEY`                        |
| JWT & Auth         | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`          |
| CORS & Security    | `ALLOWED_ORIGINS`, `CORS_ORIGIN`, `ADMIN_IP_ALLOWLIST`        |
| Redis              | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`                  |
| Email              | `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`        |
| Stellar Blockchain | `STELLAR_NETWORK`, `STELLAR_SECRET_KEY`, `STELLAR_CONTRACT_ID`|
| IPFS               | `IPFS_HOST`, `IPFS_PORT`, `IPFS_URL`                         |
| Webhooks           | `IPFS_WEBHOOK_SECRET`, `STELLAR_WEBHOOK_SECRET`, `QUEUE_HMAC_SECRET` |
| OIDC / SSO         | `OIDC_PROVIDERS`, `OIDC_{PROVIDER}_CLIENT_ID`, …             |
| Logging            | `LOG_LEVEL`, `LOKI_HOST`                                      |
| Metrics & Tracing  | `METRICS_TOKEN`, `OTEL_EXPORTER_OTLP_ENDPOINT`               |
| Backup             | `BACKUP_DIR`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_RETENTION_DAYS`|
| Feature Flags      | `TELEMEDICINE_ENABLED`, `SURGICAL_MANAGEMENT_ENABLED`         |

Generate secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Security Headers

Configured via `helmet()` in `src/main.ts` using `src/security/http-security.config.ts`:

- `Content-Security-Policy` — restricts script/style/asset sources to prevent XSS
- `X-Frame-Options: DENY` — blocks clickjacking via iframes
- `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing
- `Strict-Transport-Security` — enforces HTTPS
- `Referrer-Policy: no-referrer` — suppresses referrer leakage
- `X-XSS-Protection: 0` — disables legacy browser XSS filter in favour of CSP

## API Endpoints

### Medical Records
| Method | Path | Description |
|--------|------|-------------|
| POST | `/medical-records` | Create record |
| GET | `/medical-records/search` | Search records |
| GET | `/medical-records/:id` | Get by ID |
| GET | `/medical-records/:id/versions` | Version history |
| GET | `/medical-records/timeline/:patientId` | Patient timeline |
| PUT | `/medical-records/:id` | Update |
| PUT | `/medical-records/:id/archive` | Archive |
| PUT | `/medical-records/:id/restore` | Restore |
| DELETE | `/medical-records/:id` | Soft delete |

### Clinical Templates
| Method | Path | Description |
|--------|------|-------------|
| POST | `/clinical-templates` | Create template |
| GET | `/clinical-templates` | List active templates |
| GET | `/clinical-templates/:id` | Get by ID |
| PUT | `/clinical-templates/:id` | Update |
| DELETE | `/clinical-templates/:id` | Delete |

### Consent Management
| Method | Path | Description |
|--------|------|-------------|
| POST | `/consents` | Create consent |
| GET | `/consents/record/:recordId` | By record |
| GET | `/consents/patient/:patientId` | By patient |
| GET | `/consents/check` | Check existence |
| GET | `/consents/:id` | Get by ID |
| PUT | `/consents/:id/revoke` | Revoke |

### File Attachments
| Method | Path | Description |
|--------|------|-------------|
| POST | `/attachments/upload` | Upload file |
| GET | `/attachments/record/:recordId` | By record |
| GET | `/attachments/:id` | Get by ID |
| GET | `/attachments/:id/download` | Download |
| DELETE | `/attachments/:id` | Delete |

### Reporting
| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/patient/:patientId/summary` | Patient summary |
| GET | `/reports/activity` | Activity report |
| GET | `/reports/consent` | Consent report |
| GET | `/reports/statistics` | Statistics |

### Clinical Workflow
| Method | Path | Description |
|--------|------|-------------|
| GET | `/diagnosis/:id/treatment-plans` | Plans by diagnosis |
| GET | `/diagnosis/patient/:patientId/treatment-plans` | Patient diagnoses + plans |
| GET | `/treatment-plans` | Search treatment plans |
| GET | `/treatment-plans/:id/progress` | Plan progress |
| GET | `/pharmacy/prescriptions` | Search prescriptions |
| PATCH | `/pharmacy/prescriptions/:id` | Update prescription |
| POST | `/pharmacy/prescriptions/:id/notes` | Add note |
| GET | `/pharmacy/prescriptions/:id/notes` | Get notes |
| POST | `/clinical-notes` | Create note |
| GET | `/clinical-notes` | List notes |
| POST | `/clinical-notes/:id/sign` | Sign note |
| GET | `/clinical-notes/:id/completeness` | Completeness check |

## Postman Collection

Import from `docs/postman/MedChain.postman_collection.json`. Environments: Local, Testnet, Staging. Run the **Login** request first — all subsequent requests use the JWT automatically.

## Database Schema

| Entity | Purpose |
|--------|---------|
| `MedicalRecord` | Main record with version control |
| `MedicalRecordVersion` | Version history / audit trail |
| `MedicalHistory` | Activity timeline |
| `ClinicalNoteTemplate` | Reusable note templates |
| `MedicalAttachment` | File attachments |
| `MedicalRecordConsent` | Consent and sharing |

## Error Handling

Global `HttpExceptionFilter` formats all errors consistently, logs them, and sanitizes messages in production.

## Testing

```bash
npm run test        # unit
npm run test:e2e    # e2e
npm run test:cov    # coverage
```

## Deployment

```bash
npm run build
npm run start:prod
```

Set `NODE_ENV=production`, configure DB credentials, CORS, HTTPS, and logging before deploying.

## License

MIT

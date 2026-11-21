# Backup and Restore

## Purpose

The backend schedules encrypted, compressed PostgreSQL backups, verifies their
integrity, and supports controlled restore and restore drills. This runbook
describes how backups are produced, how to verify them, how to restore, and how
to handle failures.

## Trigger

- Routine restore drill or verification (scheduled, or before a risky change).
- A data-loss or corruption incident that requires restoring from backup.
- A backup integrity alert
  (`[ALERT] Backup integrity check failed`) or a failed backup log entry.
- Pre-migration / pre-rebuild safety checkpoint (see
  [Projection Rebuild](./projection-rebuild.md)).

## Impact

- **Full and incremental backups are online operations** (`pg_dump` / `psql`),
  but they do add database load. Full backups run daily at 02:00; incremental
  backups run every 6 hours.
- **Restoring overwrites data.** A full restore runs
  `pg_restore … --clean --if-exists` against the target database, which drops
  and recreates objects. This is destructive to current data and requires
  downtime.
- **Data loss window:** there is no defined RPO/RTO in the code. In practice the
  loss window is bounded by the backup schedule (last successful full +
  incrementals). Do not promise a specific RPO/RTO — verify the latest backup
  timestamps for the actual window.
- **Restore is gated on a verified backup.** A full recovery requires the backup
  to be in the `verified` state first.
- Backups are HIPAA-sensitive: they are encrypted and their integrity metadata is
  tracked. Handle backup files and keys accordingly.

## Prerequisites

- `admin` or `system_admin` role JWT for the `/backup/*` endpoints.
- `BACKUP_ENCRYPTION_KEY` set (services refuse to start without it) and
  `BACKUP_DIR` writable (default `/backups`).
- PostgreSQL client tools available on the application host: `pg_dump`, `psql`,
  `pg_restore`, `createdb`, `dropdb`, and `gzip`.
- Database connection variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`,
  `DB_PASSWORD`).

## Backup workflow

- **Schedule:** full backup daily at 02:00 (`EVERY_DAY_AT_2AM`); incremental
  backup every 6 hours (`0 */6 * * *`). An incremental with no prior verified
  full backup falls back to a full backup.
- **Mechanism:** `pg_dump --format=custom` for full backups; a timestamp-filtered
  NDJSON export via `psql` `COPY` for incrementals.
- **Pipeline:** dump → AES-256-GCM encrypt (`BACKUP_ENCRYPTION_KEY`) → gzip -9 →
  SHA-256 checksum stored on the `backup_logs` record.
- **Retention:** completed backups older than `BACKUP_RETENTION_DAYS`
  (default 90) are deleted by the pipeline.
- **Verification schedule:** recent completed backups are verified daily at 04:00;
  a separate daily 00:00 job checks the latest backup's checksum and emails an
  alert on failure.

## Steps

### 1. Create a backup on demand

```bash
# Full
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/backup/full"

# Incremental
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/backup/incremental"
```

The response is a `BackupLog` with `id`, `backupPath`, `backupSize`,
`checksum`, and `status`.

### 2. Inspect backup history and status

```bash
# History (default 50)
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/backup/history?limit=50"

# A single backup
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/backup/$BACKUP_ID"

# Verification counts: total / verified / unverified / failed
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/backup/verification/status"
```

### 3. Verify a backup before relying on it

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"verifiedBy":"operator@example.com"}' \
  "$API_URL/backup/$BACKUP_ID/verify"
```

Verification checks the file exists, the SHA-256 checksum matches, the file size
matches, and the HIPAA markers (encrypted, metadata version, within retention).
On success the backup becomes `verified`. Only `completed` backups can be
verified.

### 4. Run a non-destructive restore test (recommended first)

Dry-run restore validates the checksum, decrypts/decompresses, and restores into
a **temporary** database (`test_restore_<timestamp>`) that is dropped afterwards.
Production data is not touched:

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requestedBy":"operator@example.com"}' \
  "$API_URL/backup/restore/$BACKUP_ID/dry-run"
```

A dry run aborts if the checksum does not match. A failed-state backup cannot be
dry-run.

### 5. Generate a recovery plan

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"backupId":"'$BACKUP_ID'"}' \
  "$API_URL/backup/recovery/plan"
```

The plan lists ordered steps (verify integrity, decrypt, decompress, stop app,
back up current state, restore, verify, restart app, health checks, HIPAA/audit
checks) with estimated durations. The generated plan suggests
`docker-compose stop app` / `docker-compose up -d app` for the stop/start steps.

### 6. Perform the restore

Full recovery requires the backup to be `verified`. `targetDatabase` is
optional; when omitted the configured `DB_NAME` is used.

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"backupId":"'$BACKUP_ID'","targetDatabase":"healthy_stellar","performedBy":"operator@example.com"}' \
  "$API_URL/backup/recovery/execute"
```

For a validation-only restore (test database, no production change), set
`"validateOnly": true`. The result is a `RecoveryTest` record with `status`
(`passed`/`failed`) and per-step `testResults`.

### 7. Trigger the scheduled restore drill manually (optional)

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_URL/backup/recovery/drill/trigger"
```

The drill runs a `validateOnly` recovery against the latest verified full backup.
The same drill runs automatically weekly (Sunday 05:00).

## Verification

- `GET /backup/verification/status` shows the backup is `verified`.
- `GET /backup/recovery/tests` shows a `passed` `RecoveryTest` for the restore,
  with `testResults` confirming integrity, decryption, decompression, and
  restoration.
- After a full restore: run the application health check, confirm expected row
  counts and spot-check records, and confirm audit logging resumes.
- Re-run a dry-run restore after the restore to prove the restored data is
  consistent with the backup.

## Rollback / Recovery

- **A restore is destructive and has no automatic rollback.** Before executing a
  full restore, follow the generated recovery plan's step 5 — take a backup of
  the current database state. That pre-restore backup is your rollback point.
- **If the restore fails partway:** the `RecoveryTest` is marked `failed` with an
  `errorMessage`. Do not re-run blindly; inspect the failure
  (`GET /backup/recovery/tests`). If the target database is left in an
  inconsistent state, restore the pre-restore backup you captured in step 5.
- **If the backup itself is corrupt:** checksum verification fails and the
  restore aborts before touching data. Select an earlier verified backup from
  `GET /backup/history`.
- **Prefer the dry run.** Running `dry-run` first detects checksum and
  extraction problems without risking production data.

## Related Configuration

| Variable | Default | Meaning |
|---|---|---|
| `BACKUP_DIR` | `/backups` | Directory where backup files are written. |
| `BACKUP_ENCRYPTION_KEY` | — (required) | Key used for AES-256-GCM backup encryption. |
| `BACKUP_RETENTION_DAYS` | `90` | Age after which completed backups are deleted. |
| `ADMIN_EMAIL` | `admin@healthystellar.io` | Recipient of backup integrity alerts. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | — | Source/target database connection. |

## Related Code

- `src/backup/services/backup.service.ts` (create full/incremental, encrypt,
  compress, checksum, retention, schedule).
- `src/backup/services/backup-verification.service.ts` (verify, daily integrity
  check, alerts).
- `src/backup/services/disaster-recovery.service.ts` (recovery plan, execute,
  dry-run, test restore, scheduled drill).
- `src/backup/services/backup-monitoring.service.ts` (health metrics, alerts,
  statistics).
- `src/backup/controllers/backup.controller.ts` (`/backup/*` endpoints).
- `src/backup/entities/backup-log.entity.ts` (table `backup_logs`),
  `recovery-test.entity.ts`.

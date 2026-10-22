# Projection Rebuild

## Purpose

The backend maintains event-sourced read models (projections). When a projection
becomes stale or corrupted, or after a projector's logic changes, it can be
rebuilt by replaying every event from the event store into a fresh table and
atomically swapping it into place.

## Trigger

- A projection is known or suspected to be stale compared to the event store.
- A projection table is corrupted or has diverged from the events it is derived
  from.
- A projector's mapping logic was fixed and the existing read model must be
  regenerated.
- Post-recovery validation shows a read model is incomplete.

## Impact

- **Read consistency:** during a rebuild the live projection table is renamed
  away and replaced with an empty table that is progressively repopulated. The
  application is **not** paused, so any reads served from that read model may be
  incomplete until the rebuild finishes. Schedule rebuilds for low-traffic
  windows.
- **Duration:** proportional to the number of events in the store. The command
  prints progress (`processed/total`, elapsed time, ETA) every 100 events.
- **Writes are not paused** by the command. Projectors must be the only writers
  to the target table while the rebuild runs, otherwise writes can race with the
  swap.
- **Disk:** the old table is retained as `<table>_old` until the rebuild
  succeeds, so the database briefly holds two copies of the projection.

## Prerequisites

- Application configuration (`.env`) available so the CLI can bootstrap
  `AppModule` and connect to the database.
- Database credentials with permission to `ALTER TABLE`, `CREATE TABLE`, and
  `DROP TABLE` on the projection tables.
- Enough free database space to hold the renamed `_old` copy plus the new table.
- A low-traffic window, or acceptance that reads on the affected projection may
  be temporarily incomplete.
- The event store (`EventStoreService`) must be healthy and readable.

## Steps

The rebuild is performed by `scripts/projection-rebuild.ts` via the
`projection:rebuild` npm script. Exactly one projection is rebuilt per
invocation, and the `--projection` argument is required.

1. **Confirm the projector name.** Valid values (and their read-model tables):

   | Projector | Table |
   | --- | --- |
   | `RecordProjector` | `medical_records_read` |
   | `AccessGrantProjector` | `access_grants_read` |
   | `AuditProjector` | `audit_logs_projection` |
   | `AnalyticsProjector` | `analytics_snapshots` |

2. **Take a database backup** if the projection is large or the change is
   high-risk (see [Backup and Restore](./backup-and-restore.md)).

3. **Run the rebuild** for the target projector:

   ```bash
   npm run projection:rebuild -- --projection=RecordProjector
   ```

   The command performs a shadow-table swap:

   1. Rename `<table>` → `<table>_old` (preserves current data for rollback).
   2. Create a fresh empty `<table>` with the same schema (`LIKE … INCLUDING ALL`).
   3. Reset the checkpoint for the projector so it replays from event version 0.
   4. Stream every event from the store and publish it on the event bus so the
      projector writes into the new table.
   5. On success, drop `<table>_old`.

   If `--projection` is missing or unknown, the script prints the valid values
   and exits non-zero without touching any table.

4. **Watch the progress output.** The script writes a progress line every 100
   events and finishes with
   `✓ Rebuild complete: <n> events replayed in <s>s`.

## Verification

- The command exits `0` and prints the `✓ Rebuild complete` line.
- The `_old` table is gone (`<table>_old` no longer exists).
- Row counts and spot-checked records in the rebuilt projection match the event
  store's expected state.
- Application reads served from the projection return the expected data.
- The projector's checkpoint has been advanced by normal processing after the
  reset.

## Rollback / Recovery

The shadow-swap is designed to fail safe:

- **If the rebuild fails**, the script automatically drops the new
  `<table>` and renames `<table>_old` back to `<table>`, restoring the previous
  read model. It exits non-zero.
- **If the automatic rollback also fails**, the script prints
  `MANUAL ACTION REQUIRED: rename "<table>_old" back to "<table>"`. Perform that
  rename manually (after dropping any partial `<table>`), then verify the read
  model.
- **If a successful rebuild must be undone**, the old table has already been
  dropped, so there is no built-in revert. Rebuild the projection again from the
  event store (the event store is the source of truth), or restore the projection
  table from a database backup if one was taken in step 2.

## Related Configuration

- Standard database connection variables (`DB_HOST`, `DB_PORT`, `DB_USERNAME`,
  `DB_PASSWORD`, `DB_NAME`, or the regional `*_DB_URL` equivalents).
- `STELLAR_NETWORK` and other module config are loaded through `AppModule`; the
  rebuild itself does not require Stellar connectivity but will fail if the app
  context cannot be created.

## Related Code

- `scripts/projection-rebuild.ts` (shadow-table rebuild and rollback).
- `package.json` → `projection:rebuild`.
- `src/event-store/event-store.service.ts` (`count()`, `streamAll()`).
- `src/projections/checkpoint/checkpoint.service.ts` (`reset()`).
- Projector implementations under `src/projections/`.

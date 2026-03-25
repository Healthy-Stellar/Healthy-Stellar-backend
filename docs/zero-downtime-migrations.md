# Zero-Downtime Database Migrations

This guide describes how to evolve the production database schema without taking the API offline, using the **expand/contract** pattern with TypeORM.

---

## Why Expand/Contract?

A naive migration — `ALTER TABLE records DROP COLUMN old_field` — takes an `ACCESS EXCLUSIVE` lock on the table, blocking all reads and writes for the duration. On a large table this can mean seconds or minutes of downtime.

The expand/contract pattern splits every breaking schema change into two independent, non-locking deployments:

| Phase | What happens | API impact |
|-------|-------------|------------|
| **Expand** | Add new column (nullable), add index `CONCURRENTLY`, backfill data | Zero downtime — old code still works |
| **Transition** | Deploy new application code that writes to both old and new columns | Zero downtime |
| **Contract** | Drop old column once all app instances use the new column | Zero downtime — old column already unused |

---

## Rules

1. **Never drop a column in the same migration that adds its replacement.** Always use two separate migrations deployed in separate releases.
2. **New columns must be nullable** (or have a `DEFAULT`) so existing rows and old app code are unaffected.
3. **Add indexes with `CREATE INDEX CONCURRENTLY`** — this never takes a table lock.
4. **Backfill in batches** — never `UPDATE` millions of rows in a single transaction.
5. **Every migration must have a working `down()` rollback.**
6. **The CI nullability gate** (`scripts/check-migration-safety.js`) must pass before merging any migration that removes a column.

---

## Phase 1 — Expand Migration

The expand phase adds the new column and backfills existing data. The old column is left untouched so the currently-deployed application continues to work.

### Example: rename `records.description` → `records.summary`

**Migration file:** `src/migrations/1772300000000-ExpandRecordsAddSummary.ts`

```typescript
// See: src/migrations/1772300000000-ExpandRecordsAddSummary.ts
```

**What it does:**
- Adds `summary` column as `TEXT NULL` (no lock, instant)
- Backfills `summary` from `description` in batches of 1 000 rows
- Adds an index on `summary` using `CONCURRENTLY` (no table lock)

**Deploy order:**
1. Run expand migration → `npm run migration:run`
2. Deploy new application code that reads/writes **both** `description` and `summary`
3. Monitor for errors

---

## Phase 2 — Contract Migration

Once every running application instance has been updated to use the new column exclusively, the old column can be safely dropped.

**Migration file:** `src/migrations/1772400000000-ContractRecordsDropDescription.ts`

```typescript
// See: src/migrations/1772400000000-ContractRecordsDropDescription.ts
```

**What it does:**
- Verifies no rows still have `summary IS NULL` (safety check)
- Drops the `description` column
- Drops the old index on `description` if one existed

**Deploy order:**
1. Confirm all app instances are on the new code (check deployment dashboard)
2. Confirm `SELECT COUNT(*) FROM records WHERE summary IS NULL` returns 0
3. Run contract migration → `npm run migration:run`

---

## Rollback Strategy

Every migration has a `down()` method. To roll back:

```bash
# Roll back the most recent migration
npm run migration:revert

# Roll back two migrations
npm run migration:revert
npm run migration:revert
```

### Expand rollback
Dropping a newly-added nullable column is safe and instant — no data loss, no lock contention.

### Contract rollback
Restoring a dropped column requires re-adding it as nullable and re-running the backfill. The `down()` in the contract migration does exactly this.

> **Important:** If you have already deployed application code that no longer writes to the old column, rolling back the contract migration will restore the column but it will be empty. You must also roll back the application deployment.

---

## CI Safety Gate

The script `scripts/check-migration-safety.js` runs in CI and **blocks merges** if any migration:

- Drops a column that was `NOT NULL` in the previous migration (must be made nullable first)
- Drops a column without a corresponding expand migration in the same PR

```bash
node scripts/check-migration-safety.js
```

Exit code `0` = safe. Exit code `1` = unsafe, merge blocked.

---

## Checklist for Every Schema Change

- [ ] New column is nullable or has a `DEFAULT`
- [ ] Index added with `CONCURRENTLY`
- [ ] Backfill done in batches (≤ 1 000 rows per transaction)
- [ ] `down()` rollback implemented and tested locally
- [ ] Expand migration merged and deployed before contract migration is written
- [ ] CI safety gate passes (`node scripts/check-migration-safety.js`)
- [ ] Contract migration only merged after 100% of app instances use new column

---

## Quick Reference

```bash
# Generate a new migration (empty)
npm run migration:generate -- src/migrations/MyMigration

# Run all pending migrations
npm run migration:run

# Roll back the last migration
npm run migration:revert

# Check migration safety (CI gate)
node scripts/check-migration-safety.js
```

---

## Further Reading

- [PostgreSQL ALTER TABLE locking](https://www.postgresql.org/docs/current/sql-altertable.html)
- [CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- [Evolutionary Database Design — Fowler & Sadalage](https://martinfowler.com/articles/evodb.html)

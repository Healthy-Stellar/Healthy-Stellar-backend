# Migration Safety

## Purpose

This runbook describes the GitHub Actions migration safety gate used for PRs
targeting `main`. It explains the failure categories and the process for force
approval when a repo admin has reviewed a migration.

The migration safety gate protects the application from destructive or unsafe
database changes such as:

- dropping tables
- dropping columns without a prior nullable phase
- adding NOT NULL columns without a default value
- removing unique indexes or unique constraints used by the application
- missing rollback logic

## Trigger

- A pull request targeting `main` fails the **Migration safety gate**
  (`.github/workflows/migration-safety.yml`).
- You are adding, editing, or reviewing a TypeORM migration under
  `src/migrations/`.
- A release is blocked because the gate reports violations and no
  `migration-reviewed` label is present.

## Impact

- When the gate fails, the PR cannot merge until the violation is fixed or the
  `migration-reviewed` label is applied by an authorised reviewer.
- Applying `migration-reviewed` **bypasses the gate**. It is an explicit
  acknowledgement that a potentially destructive change was reviewed; an
  incorrect bypass can ship schema changes that lose data or break deployments.
- The gate is static analysis only — it does not execute migrations and cannot
  detect every unsafe change. Reviewer judgement is still required.

## Prerequisites

- Node.js available locally to run `npm run check:migrations`.
- Repository write access and, to approve, the ability to add the
  `migration-reviewed` label to a PR.
- Admin or trusted-reviewer privileges for bypassing the gate.

## How the gate works

The CI job runs `npm run check:migrations`, which executes
`scripts/check-migration-safety.js`. If the script finds a violation, the PR
fails unless the `migration-reviewed` label is present. Only a repo admin or
trusted reviewer should add the `migration-reviewed` label to bypass the gate.

## Steps

1. Run the same check locally that CI runs:

   ```bash
   npm run check:migrations
   ```

   The script prints a summary of detected destructive operations and each
   violation with its file, rule, and problem.

2. Identify the rule(s) reported and apply the corresponding fix below.

3. Re-run `npm run check:migrations` until no violations remain, then push the
   updated migration file(s) and let CI re-run.

4. If the change is intentionally destructive and has been reviewed by a repo
   admin, add the `migration-reviewed` label to the PR (see
   [When to use `migration-reviewed`](#when-to-use-migration-reviewed)).

## Failure categories

### DROP_WITHOUT_NULLABLE_STEP

This means a migration drops a column before that column has been made nullable
in an earlier release. Safe schema evolution requires an expand phase first (make
the column nullable or introduce a nullable replacement), then a later contract
phase to remove the column.

### SAME_MIGRATION_ADD_DROP

This means a migration file both adds and drops the same column. The correct
pattern is to split the work into separate migrations released at different
times: one expand migration, then one contract migration.

### MISSING_ROLLBACK

This means the migration file does not export a usable `down()` method. Every
migration must include a rollback path so that deployments can be reverted
safely.

### DROP_TABLE

This means the migration drops an entire table. Table drops are destructive and
require explicit review; application behavior and data retention must be
validated before merging.

### ADD_NOT_NULL_WITHOUT_DEFAULT

This means a migration adds or alters a column to be `NOT NULL` without
specifying a `DEFAULT` or ensuring existing rows already satisfy the constraint.
This can break migrations on production data unless the column is filled safely
first.

### REMOVE_UNIQUE_INDEX

This means a migration removes a unique index or unique constraint that appears
to be application-facing. Removing unique indexes can change data integrity
guarantees and should be reviewed with the application schema in mind.

## When to use `migration-reviewed`

If a migration is intentionally destructive but has been reviewed and approved by
a repo admin, add the label `migration-reviewed` to the PR. That label allows the
GitHub Actions migration safety gate to pass even if the script reports
violations.

> Important: only repo admins or trusted reviewers should apply this label.

## Verification

- `npm run check:migrations` exits `0` and prints
  `All migrations are safe. No policy violations found.`
- The **Migration safety gate** job in GitHub Actions passes (green).
- If the label was used, the PR shows the `migration-reviewed` label and the
  workflow step logs `Passing as admin-approved.`

## Rollback / Recovery

- A **reverted PR** requires no migration rollback: nothing was applied to any
  database. Delete the branch or revert the merge, and the gate re-evaluates.
- If an unsafe migration already reached an environment, use the migration's
  `down()` method (`npm run migration:revert`) — this is exactly why the gate
  requires a usable `down()`. Restore from backup if the revert is not
  sufficient (see [Backup and Restore](./backup-and-restore.md)).
- Do not remove the `migration-reviewed` label to "roll back" a merge; labels do
  not affect already-applied schema changes.

## Related Configuration

- CI workflow: `.github/workflows/migration-safety.yml`
- PR label: `migration-reviewed`

## Related Code

- `scripts/check-migration-safety.js` (the gate implementation).
- `npm run check:migrations` script in `package.json`.
- TypeORM migrations under `src/migrations/`.

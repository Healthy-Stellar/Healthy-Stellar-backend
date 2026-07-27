# Migration Safety Operator Runbook

This runbook describes the GitHub Actions migration safety gate used for PRs targeting `main`.
It explains the failure categories and the process for force approval when a repo admin has reviewed a migration.

## Purpose

The migration safety gate protects the application from destructive or unsafe database changes such as:

- dropping tables
- dropping columns without a prior nullable phase
- adding NOT NULL columns without a default value
- removing unique indexes or unique constraints used by the application
- missing rollback logic

## How the gate works

The CI job runs `npm run check:migrations`, which executes `scripts/check-migration-safety.js`.
If the script finds a violation, the PR fails unless the `migration-reviewed` label is present.
Only a repo admin or trusted reviewer should add the `migration-reviewed` label to bypass the gate.

## Failure categories

### DROP_WITHOUT_NULLABLE_STEP

This means a migration drops a column before that column has been made nullable in an earlier release.
Safe schema evolution requires an expand phase first (make the column nullable or introduce a nullable replacement), then a later contract phase to remove the column.

### SAME_MIGRATION_ADD_DROP

This means a migration file both adds and drops the same column.
The correct pattern is to split the work into separate migrations released at different times: one expand migration, then one contract migration.

### MISSING_ROLLBACK

This means the migration file does not export a usable `down()` method.
Every migration must include a rollback path so that deployments can be reverted safely.

### DROP_TABLE

This means the migration drops an entire table.
Table drops are destructive and require explicit review; application behavior and data retention must be validated before merging.

### ADD_NOT_NULL_WITHOUT_DEFAULT

This means a migration adds or alters a column to be `NOT NULL` without specifying a `DEFAULT` or ensuring existing rows already satisfy the constraint.
This can break migrations on production data unless the column is filled safely first.

### REMOVE_UNIQUE_INDEX

This means a migration removes a unique index or unique constraint that appears to be application-facing.
Removing unique indexes can change data integrity guarantees and should be reviewed with the application schema in mind.

## When to use `migration-reviewed`

If a migration is intentionally destructive but has been reviewed and approved by a repo admin, add the label `migration-reviewed` to the PR.
That label allows the GitHub Actions migration safety gate to pass even if the script reports violations.

> Important: only repo admins or trusted reviewers should apply this label.

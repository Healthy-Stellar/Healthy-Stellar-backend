# Operator Runbooks

Operational procedures for operating, troubleshooting, recovering, and maintaining
Healthy-Stellar. These runbooks are written for on-call engineers and operators who
already have access to the production environment.

> These documents are operational runbooks. They are **not** application code. The
> NestJS module that serves runbook content over HTTP lives in
> [`src/operator-runbook/`](../../src/operator-runbook/) and is unrelated to the
> Markdown procedures in this directory.

## Runbooks

| Procedure | Purpose |
| --- | --- |
| [Key Rotation](./key-rotation.md) | Rotate the master wrapping key / DEK master key for the KeyStore and envelope key management adapters. |
| [Migration Safety](./migration-safety.md) | Understand and act on the CI migration safety gate (`npm run check:migrations`). |
| [Break-Glass Access Review](./break-glass-access-review.md) | Review, revoke, and reconcile emergency patient-record access granted through break-glass. |
| [Balance Reconciliation Discrepancies](./balance-reconciliation.md) | Investigate Stellar vs internal ledger discrepancies and anchor reconciliation failures. |
| [Dead-Letter Queue Inspection and Replay](./dead-letter-queue.md) | Inspect jobs that exhausted retries, decide whether to replay, and replay them safely. |
| [Projection Rebuild](./projection-rebuild.md) | Rebuild an event-sourced read model with `npm run projection:rebuild`. |
| [Backup and Restore](./backup-and-restore.md) | Verify backups, run restore drills, and perform a database restore. |

## Conventions used in these runbooks

Each runbook follows the same structure so operators can navigate them under pressure:

- **Purpose** — what the procedure achieves.
- **Trigger** — the conditions that call for this procedure.
- **Impact** — the effect the procedure has on the service, data, and compliance posture.
- **Prerequisites** — access, configuration, and tools required.
- **Steps** — the supported actions, using real endpoints and scripts from this repository.
- **Verification** — how to confirm success.
- **Rollback / Recovery** — how to safely undo or recover from a failed procedure.
- **Related Configuration** — the environment variables that govern the behavior.
- **Related Code** — the implementation these steps are derived from.

## HTTP endpoints referenced here

The API enables URI versioning (default version `1`, with `VERSION_NEUTRAL`
fallback), so the paths shown in these runbooks are also reachable under `/v1`
(for example, `POST /v1/admin/reconciliation/trigger`). All admin endpoints require a
JWT with the `admin` role unless stated otherwise.

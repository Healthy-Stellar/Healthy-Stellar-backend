# Dead-Letter Queue Inspection and Replay

## Purpose

When a BullMQ job exhausts all of its retries it is persisted to the
`dlq_jobs` table so it can be inspected and replayed outside of Redis (which is
volatile). This runbook describes how to inspect dead-letter entries, decide
whether a replay is safe, replay them, and handle failures.

## Trigger

- A permanent-failure alert is emitted (`dlq.job.permanent-failure`) and logged,
  for example `[DLQ] Permanent failure alert: job=… queue=… reason="…"`.
- `GET /admin/dlq/stats` shows a growing number of `failed` entries for a queue.
- A user reports work that never completed (a transaction, report, export,
  email, or import that silently failed).
- Queues are draining slower than expected and you suspect poison messages.

## Impact

- **Failed entries** represent real work that did **not** happen. Until replayed
  or discarded, the underlying operation (a contract write, email notification,
  report generation, EHR import, etc.) is incomplete.
- **Replaying re-executes the job's side effects.** Replay is **not idempotent**
  at the DLQ level: the payload is re-enqueued as-is, and the system does not
  deduplicate against work that may have partially succeeded. A job that failed
  *after* performing a side effect will perform it again on replay.
- Replaying a burst of entries (especially `replay-all`) can create load
  downstream (Stellar, IPFS, email, database).
- Discarding an entry marks it `discarded` and it cannot be replayed afterwards.

## Prerequisites

- `admin` role JWT (all DLQ endpoints require the `admin` role).
- Access to application logs to correlate a job id with its failure reason.
- Knowledge of which queue is affected and whether the target dependency
  (Horizon/Stellar, Redis, SMTP, IPFS, database) is healthy.

## Steps

### 1. Get an overview by queue and status

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/admin/dlq/stats"
```

The response is grouped by queue name with `failed`, `replayed`, and
`discarded` counts.

### 2. List failed entries (optionally filter by queue)

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_URL/admin/dlq?status=failed&queueName=stellar-transactions&limit=50&offset=0"
```

Supported filters: `queueName`, `status` (`failed`, `replayed`, `discarded`),
`limit`, `offset`. Results are ordered newest-failure first and include the
`total` count. The same data is available under `GET /dlq/jobs`.

### 3. Inspect a single entry in detail

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/admin/dlq/$DLQ_ID"
```

Review `jobId`, `queueName`, `jobName`, `data` (the payload), `failedReason`,
`stackTrace`, `attemptsMade`, `status`, and `replayCount`.

### 4. Decide whether replay is safe

Before replaying, confirm:

- **The root cause is resolved** (Horizon is reachable, the report template is
  fixed, credentials are valid, the downstream service is up).
- **The job is safe to repeat.** Cross-check `jobName`/`queueName` and the
  payload. Jobs that are not naturally idempotent (for example, an operation
  that already partially wrote to an external system) may duplicate work.
- **The entry has not been discarded** — discarded entries reject replay with a
  `400`.

If a job is unsafe to repeat, do not replay it; use `discard` to record that it
will not be retried, and resolve the underlying data manually.

### 5. Replay a single entry

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_URL/admin/dlq/$DLQ_ID/replay"
```

The response contains the original `jobId`, the `queueName`, and the new
`newBullJobId`. The entry's status becomes `replayed`, `replayCount` is
incremented, and `replayedBy` records the acting admin.

Replayed jobs are enqueued with up to 4 attempts and exponential backoff
(1 s → 2 s → 4 s) using BullMQ's built-in `exponential` backoff;
`removeOnComplete: true` and `removeOnFail: false`. If the replay fails again it
can be replayed again from the same DLQ entry.

### 6. Replay all failed entries for a queue (or all queues)

Use with care — this replays up to 500 failed entries:

```bash
# All failed entries
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/admin/dlq/replay-all"

# All failed entries for one queue
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_URL/admin/dlq/replay-all?queueName=email-notifications"
```

Individual failures during `replay-all` are logged and skipped; the endpoint
returns the list of successfully replayed entries.

### 7. Discard an entry that must not be retried

```bash
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/admin/dlq/$DLQ_ID"
```

Discarded entries cannot be replayed.

## Verification

- `GET /admin/dlq/stats` shows the affected queue's `failed` count decreasing and
  `replayed` increasing.
- The replayed job completes: it disappears from the queue
  (`removeOnComplete: true`) and the downstream effect is observable (for
  example, the record is anchored, the email is delivered, the report exists).
- The DLQ entry shows `status: replayed` with an incremented `replayCount`.
- No new permutations of the same failure reason are captured after replay.

## Rollback / Recovery

- **Replay caused duplicate processing:** the DLQ has no automatic undo of an
  already-executed job. Identify the duplicated effect and correct it through the
  owning subsystem (for example, re-run reconciliation for a duplicated anchor —
  see [Balance Reconciliation](./balance-reconciliation.md)). Record the incident
  so the duplication is auditable.
- **Replay burst overloaded downstream:** stop the worker process to stop
  consuming the queue, wait for the downstream dependency to recover, then
  restart the worker. Entries remain in the DLQ with `status: replayed`, so no
  information is lost.
- **Replayed the wrong entry:** the DLQ cannot "un-replay" it. If the wrong
  entry was a notification or similar side effect, remediate in the owning
  system; the `replayedBy` field records who performed the replay.

## Related Configuration

- DLQ retry constants are code-defined, not environment-driven:
  `DLQ_MAX_ATTEMPTS = 4` (1 initial attempt + 3 retries) and
  `DLQ_BASE_DELAY_MS = 1000`.
- The capture listener connects to Redis using `REDIS_HOST`, `REDIS_PORT`,
  `REDIS_PASSWORD`, and `REDIS_DB`.

## Related Code

- `src/dlq/dlq.service.ts` (capture, list, replay, replay-all, discard, stats).
- `src/dlq/dlq.controller.ts` (`/admin/dlq/*`) and
  `src/dlq/dlq-jobs.controller.ts` (`/dlq/jobs*`).
- `src/dlq/dlq-capture.listener.ts` (captures jobs when retries are exhausted).
- `src/dlq/dlq-job.entity.ts` (table `dlq_jobs`; statuses `failed`, `replayed`,
  `discarded`).
- `src/dlq/dlq-retry.strategy.ts` (attempt and backoff constants).
- Queues are defined in `src/queues/queue.constants.ts`.

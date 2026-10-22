# Balance Reconciliation Discrepancies

## Purpose

Two independent reconciliation mechanisms run against Stellar:

1. **Anchor reconciliation** — checks records that carry a `stellarTxHash`
   against Horizon to confirm the anchoring transaction landed, and re-queues
   failed or missing anchors.
2. **Stellar balance reconciliation** — compares each tracked Stellar account's
   Horizon balance against the internal ledger total and raises an alert when
   the accumulated discrepancy exceeds a threshold.

This runbook covers investigating and remediating both.

## Trigger

- Nightly balance reconciliation emails an alert
  (`[ALERT] Stellar balance discrepancy: … XLM`) to `ADMIN_EMAIL`.
- `GET /admin/reconciliation/reports` returns a report with
  `discrepancyThresholdExceeded: true`.
- The anchor reconciliation metric `medchain_reconciliation_discrepancies_total`
  increases (`type="failed"`, `type="missing"`, or `type="detected_only"`).
- The ops alert fires when more than `MISSING_ALERT_THRESHOLD` (5) missing
  transactions are detected in a single anchor run.

## Impact

- An unmatched balance means the internal ledger's view of an account does not
  agree with the chain. Until reconciled, financial reporting and any feature
  derived from ledger totals are unreliable.
- Missing anchors mean record hashes are not yet confirmed on-chain; if the
  re-queue limit (`MAX_REQUEUE_ATTEMPTS` = 3) is reached, the record is flagged
  as `detected_only` and will **not** be retried automatically — it needs manual
  investigation.
- A Horizon outage can itself cause alerts: when a Horizon fetch fails, the
  reconciliation records a synthetic discrepancy and marks the account
  `unmatched`. Confirm Horizon health before treating this as a data problem.

## Prerequisites

- `admin` role JWT for the `/admin/reconciliation/*` endpoints.
- Read access to application logs (the reconciliation services log per-run
  summaries) and to the Prometheus metric
  `medchain_reconciliation_discrepancies_total`.
- Ability to query `ledger_reconciliation_reports` and the internal ledger data
  for investigation.
- Optional: `STELLAR_NETWORK` set correctly (`mainnet` selects
  `https://horizon.stellar.org`, otherwise testnet).

## Steps

### A. Inspect the latest results

1. **Get the latest anchor reconciliation summary:**

   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_URL/admin/reconciliation/latest"
   ```

   The summary reports `recordsChecked`, `confirmed`, `failed`, `missing`, and
   `errors`.

2. **List historical balance reports:**

   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "$API_URL/admin/reconciliation/reports?limit=50"
   ```

   Each report includes `accountsChecked`, `matched`, `unmatched`,
   `discrepancyTotal`, `discrepancyThresholdExceeded`, `alertSent`, and a
   per-account `details` array with `accountId`, `horizonBalance`,
   `internalBalance`, and `discrepancy`.

3. **Identify the offending accounts** in `details` where `status` is
   `unmatched` or `not_found`.

### B. Determine the likely cause

- **`not_found`** — the account does not exist on Horizon. It may not be funded
  yet, or the address is wrong.
- **`unmatched` with both balances at `0`** — a Horizon fetch failed (network,
  rate limit, outage). Check Horizon status and application logs for
  `Horizon fetch failed for <account>`.
- **`unmatched` with a real difference** — the internal ledger total and Horizon
  disagree. The internal total is the sum of `amount` for `status = 'confirmed'`
  rows in `stellar_ledger_entries` for that account; investigate whether a
  confirmed entry is missing, duplicated, or mis-attributed.

### C. Reconcile the anchor queue

Re-run the anchor reconciliation to re-queue failed/missing transactions:

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_URL/admin/reconciliation/trigger"
```

Re-queued anchors are bounded: at most 3 attempts per record. A record that has
exhausted its attempts is counted under `type="detected_only"` and is **not**
re-queued — these require manual investigation of the underlying transaction or
record state.

### D. Re-run balance reconciliation after remediation

Once the underlying ledger entries or transactions have been corrected, trigger a
fresh balance reconciliation and confirm it matches:

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API_URL/admin/reconciliation/balance/trigger"
```

The nightly job (`0 2 * * *`) and the anchor job (every 2 hours) also run
automatically.

## Verification

- The new `GET /admin/reconciliation/latest` summary shows `missing: 0` and
  `failed: 0` (or the remaining counts are understood and tracked).
- The newest balance report shows `unmatched: 0`, or a `discrepancyTotal` below
  `RECONCILIATION_DISCREPANCY_THRESHOLD_XLM`.
- `medchain_reconciliation_discrepancies_total` stops increasing.
- No new discrepancy alert email is sent on the next nightly run.

> Threshold semantics: the alert fires when the **sum of absolute discrepancies
> across all accounts** exceeds `RECONCILIATION_DISCREPANCY_THRESHOLD_XLM`
> (default `1.0`). A large number of individually small mismatches can therefore
> trip the alert even though no single account is off by the threshold.

## Rollback / Recovery

- **Do not manually edit balances.** There is no supported endpoint or command
  for arbitrary balance manipulation; doing so would corrupt the reconciliation
  signal.
- If a reconciliation was triggered by mistake, it is read-only with respect to
  balances — it only writes a report row and, for anchors, re-queues jobs. No
  rollback is required.
- If a re-queue caused an undesirable burst of anchor jobs, stop the worker
  process to drain the queue, then investigate before restarting; the record's
  `reconciliationAttempts` counter is the authoritative record of how many
  times it has been re-queued.
- If a Horizon outage caused spurious unmatched accounts, re-run reconciliation
  once Horizon is healthy rather than acting on the failed-run report.

## Related Configuration

| Variable | Default | Meaning |
|---|---|---|
| `RECONCILIATION_DISCREPANCY_THRESHOLD_XLM` | `1.0` | Total absolute XLM discrepancy that triggers the alert. |
| `ADMIN_EMAIL` | `admin@healthystellar.io` | Recipient of discrepancy alerts. |
| `STELLAR_NETWORK` | — | `mainnet` selects the mainnet Horizon; otherwise testnet. |
| `OPS_SLACK_WEBHOOK_URL` | — | Optional Slack webhook for anchor missing-transaction alerts. |

## Related Code

- `src/ledger-reconciliation/stellar-balance-reconciliation.service.ts`
  (balance reconciliation, threshold, alerts; table
  `ledger_reconciliation_reports`).
- `src/ledger-reconciliation/ledger-reconciliation.service.ts` (anchor
  reconciliation, re-queue bound, ops alert).
- `src/ledger-reconciliation/reconciliation.job.ts` (cron schedules:
  every 2 hours for anchors, nightly 02:00 UTC for balances).
- `src/ledger-reconciliation/reconciliation.controller.ts`,
  `reconciliation.metrics.ts` (`medchain_reconciliation_discrepancies_total`).

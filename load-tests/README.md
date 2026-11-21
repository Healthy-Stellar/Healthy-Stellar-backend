# Load Tests

k6-based load test suite for the Healthy-Stellar backend. Covers REST endpoints, GraphQL subscriptions, and Stellar blockchain write operations.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment variables](#environment-variables)
- [Scenario reference](#scenario-reference)
- [npm scripts quick-reference](#npm-scripts-quick-reference)
- [Baseline / Compare / Gate workflow](#baseline--compare--gate-workflow)
- [CI integration](#ci-integration)
- [Stellar write tests — safety warning](#stellar-write-tests--safety-warning)
- [Grafana dashboard](#grafana-dashboard)
- [Results directory](#results-directory)

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [k6](https://k6.io/docs/get-started/installation/) | ≥ 0.49 | Must be on `PATH`. No k6 extensions required. |
| Node.js | ≥ 18 | Only needed for the gate/compare scripts (`load-test:gate`, `load-test:compare`). |
| A running API | — | Default target is `http://localhost:3000`. Start the stack with `docker compose up`. |

**Install k6 (choose one):**

```bash
# macOS
brew install k6

# Linux
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows (winget)
winget install k6 --source winget
```

---

## Environment variables

Copy `.env.example` and adjust:

```bash
cp load-tests/.env.example load-tests/.env
```

| Variable | Default | Required for |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | All tests |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@test.com` / `Admin123!@#` | Auth-dependent scenarios |
| `DOCTOR_EMAIL` / `DOCTOR_PASSWORD` | `doctor@test.com` / `Doctor123!@#` | Provider-write scenarios |
| `AUTH_TOKEN` | `testnet-jwt-placeholder` | Stellar write tests (see warning below) |
| `SUBSCRIPTION_WS_URL` | `ws://localhost:3000/graphql` | GraphQL subscription test |
| `SUBSCRIPTION_AUTH_TOKEN` | — | GraphQL subscription test |
| `SUBSCRIPTION_PATIENT_ID` | — | GraphQL subscription test |
| `SUBSCRIPTION_REPLAY_CURSOR` | — | Optional event-replay cursor |
| `INFLUXDB_URL` / `INFLUXDB_DB` / `INFLUXDB_TOKEN` | `http://localhost:8086` / `k6` / — | Optional metrics streaming |
| `TOLERANCE` | `0.20` | `compare-baseline.js` (20 % regression threshold) |
| `TEST_TYPE` | `smoke` | `comprehensive-test.js` (smoke / load / stress / soak) |

k6 reads variables via `--env KEY=value` flags or the shell environment. The `.env` file is **not** loaded automatically by k6; source it manually or use a wrapper:

```bash
export $(grep -v '^#' load-tests/.env | xargs)
npm run load-test:smoke
```

---

## Scenario reference

### Top-level scripts

| File | Purpose | VUs / duration | Target |
|---|---|---|---|
| `production-load-test.js` | Four concurrent scenarios that mirror production: 100 patient reads, 50 provider writes, 200 health checks, spike 0 → 500 → 0. Generates an HTML + JSON report. | ~5 min | Staging / local |
| `comprehensive-test.js` | Single entry-point for all four core flows (auth, upload, fetch, access). Behaviour is controlled by `TEST_TYPE`. | See table below | Local / staging |
| `graphql-subscriptions-load-test.js` | 1 000 concurrent WebSocket clients using `graphql-transport-ws`, holding subscriptions for 60 s. Measures delivery latency (p99 < 200 ms). | 1 000 VUs / 60 s | Local / staging |

#### `comprehensive-test.js` TEST_TYPE modes

| `TEST_TYPE` | VUs (auth / upload / fetch / access) | Duration |
|---|---|---|
| `smoke` (default) | 1 / 1 / 1 / 1 | 1 min |
| `load` | ramp to 500 / 100 / 1 000 / 200 | ~11 min |
| `stress` | ramp to 1 500 / 300 / 3 000 / 600 | ~26 min |
| `soak` | ramp to 250 / 50 / 500 / 100, hold 3 h | ~3 h 10 min |

### `scenarios/` — individual focused scripts

| File | What it tests | Safe for staging? |
|---|---|---|
| `auth-flow.js` | Login + token refresh cycle | Yes |
| `record-upload.js` | `POST /records` with realistic payload | Yes |
| `record-fetch.js` | `GET /records` + detail fetch | Yes |
| `access-control.js` | Grant / revoke patient access | Yes |
| `patient-reads.js` | Patient record listing | Yes |
| `provider-writes.js` | Provider record creation | Yes |
| `health-check-flood.js` | `GET /health` at high concurrency | Yes |
| `fulltext-search.js` | Full-text search endpoint | Yes |
| `spike-test.js` | Sudden concurrency ramp | Yes — but creates test data |

### `stellar-write/` — blockchain write suite

| File | Purpose | VUs / duration |
|---|---|---|
| `Smoke.js` | Single VU sanity-check for `POST /medical-records` with `anchorToBlockchain: true` | 1 VU / 30 s |
| `Stellar-write.test.js` | Three sequential scenarios: smoke → ramp_load (1 → 20 VU) → stress (1 → 50 VU). Full SLA coverage. | ~14 min |
| `Stress.js` | Isolated stress ramp for Stellar writes | See file |
| `Soak.js` | Extended Stellar write endurance | See file |

SLA thresholds enforced by `Stellar-write.test.js`:

| Metric | Threshold |
|---|---|
| `stellar_record_creation_duration` p50 | < 3 000 ms |
| `stellar_record_creation_duration` p95 | < 8 000 ms |
| `stellar_record_creation_duration` p99 | < 15 000 ms |
| `http_req_failed` | < 5 % |
| `stellar_error_rate` | < 5 % |

---

## npm scripts quick-reference

```bash
# Smoke — fast sanity check (< 2 min)
npm run load-test:smoke

# Individual focused scenarios
npm run load-test:auth
npm run load-test:fetch
npm run load-test:upload
npm run load-test:access
npm run load-test:health-checks
npm run load-test:spike
npm run load-test:subscriptions

# Full production scenario (HTML report generated)
npm run load-test:production

# Comprehensive suite by load level
npm run load-test:load     # ~11 min
npm run load-test:stress   # ~26 min
npm run load-test:soak     # ~3 h 10 min  ← staging only

# Baseline / regression workflow (see section below)
npm run load-test:baseline
npm run load-test:compare
npm run load-test:gate

# Stellar blockchain writes (reads testnet funds — see warning)
./load-tests/run-stellar-load-tests.sh                          # local defaults
./load-tests/run-stellar-load-tests.sh testnet <JWT>            # testnet
./load-tests/run-stellar-load-tests.sh staging <JWT> https://… # staging

# CI all-in-one (production run + gate)
npm run load-test:ci
```

---

## Baseline / Compare / Gate workflow

These three scripts form a lightweight performance regression guard.

```
load-test:baseline  →  run once to capture the "good" state
load-test:compare   →  run after code changes to detect regressions
load-test:gate      →  run in CI to block a deployment on failures
```

### Step 1 — capture a baseline

```bash
npm run load-test:baseline
```

Internally: runs `comprehensive-test.js` with `TEST_TYPE=load`, then copies the results to `load-tests/baselines/load-baseline.json`. Commit this file so the baseline travels with the code.

### Step 2 — compare against the baseline

```bash
npm run load-test:compare
```

Runs the same load test and passes the output to `scripts/compare-baseline.js`. The script compares `http_req_duration` (avg / p95 / p99), per-scenario p95, and the error rate against the baseline. A metric is flagged as a regression if it exceeds **baseline × (1 + TOLERANCE)** (default 20 %). The comparison report is saved to `load-tests/results/comparison-load-<timestamp>.txt`.

Regression severity levels:

| Change vs baseline | Severity |
|---|---|
| > 20 % (configurable) | medium |
| > 30 % | high |
| > 50 % | critical |
| Error rate increase > 1 pp | critical |

The script exits with code `1` if any regression is found, making it suitable as a pre-merge check.

### Step 3 — CI gate

```bash
npm run load-test:gate
```

Reads `load-tests/results/production-latest.json` (written by `load-test:production`) and enforces these hard acceptance criteria:

| Criterion | Threshold |
|---|---|
| Patient reads p95 | < 500 ms |
| Provider writes p95 | < 2 000 ms |
| Health checks p95 | < 100 ms |
| Spike test p95 | < 2 000 ms |
| Global HTTP error rate | < 2 % |
| Spike error rate | < 5 % |

Exit code `0` → deployment approved. Exit code `1` → deployment blocked. Exit code `2` → results file missing (run `load-test:production` first).

A custom results file can be passed directly:

```bash
node load-tests/scripts/ci-gate.js load-tests/results/my-run.json
```

---

## CI integration

`load-test:ci` is the all-in-one command used in pipelines:

```bash
npm run load-test:ci
# equivalent to:
# k6 run --out json=load-tests/results/production-latest.json load-tests/production-load-test.js \
#   && node load-tests/scripts/ci-gate.js
```

Typical GitHub Actions usage:

```yaml
- name: Run load tests
  run: npm run load-test:ci
  env:
    BASE_URL: ${{ secrets.STAGING_URL }}
    ADMIN_EMAIL: ${{ secrets.LOAD_TEST_ADMIN_EMAIL }}
    ADMIN_PASSWORD: ${{ secrets.LOAD_TEST_ADMIN_PASSWORD }}
```

The job will fail if any gate criterion is violated, blocking deployment to the next environment.

---

## Stellar write tests — safety warning

> **The `stellar-write/` tests send real transactions to the Stellar testnet and consume testnet XLM. Do not point them at Mainnet.**

The scripts set `anchorToBlockchain: true` in every payload, which causes the API to submit a Stellar transaction for each created record. Under load (up to 50 concurrent VUs) this can create hundreds of on-chain transactions per minute.

**Rules of thumb:**

- Run `stellar-write/` tests against **local** or **testnet** only.
- Always pass a valid testnet JWT via `AUTH_TOKEN`; the placeholder value (`testnet-jwt-placeholder`) will be rejected by the API and cause 100 % errors.
- Use the shell wrapper which confirms the environment before running:

  ```bash
  ./load-tests/run-stellar-load-tests.sh testnet <your-jwt>
  ```

- To run a single scenario instead of the full suite, set `SCENARIO`:

  ```bash
  SCENARIO=smoke ./load-tests/run-stellar-load-tests.sh testnet <your-jwt>
  # SCENARIO options: smoke | stress | soak | full | all (default)
  ```

- Results are saved to `load-tests/results/` with a timestamp suffix.

---

## Grafana dashboard

A pre-built k6 dashboard is provided at `load-tests/grafana/k6-dashboard.json`.

**Prerequisites:** the monitoring stack must be running (`docker compose --profile monitoring up`). This starts Grafana on port 3001, Prometheus on 9090, and InfluxDB on 8086.

**Import steps:**

1. Open Grafana at `http://localhost:3001` (default credentials: `admin` / `admin`).
2. Go to **Dashboards → Import**.
3. Click **Upload JSON file** and select `load-tests/grafana/k6-dashboard.json`.
4. Select the **InfluxDB** data source (configured automatically by `docker/monitoring/grafana/datasources/datasources.yml`).
5. Click **Import**.

**Stream k6 results live to InfluxDB:**

```bash
k6 run \
  --out influxdb=http://localhost:8086/k6 \
  load-tests/production-load-test.js
```

Or set the env vars and use an npm script:

```bash
INFLUXDB_URL=http://localhost:8086 \
INFLUXDB_DB=k6 \
npm run load-test:production
```

The dashboard shows request rate, p95/p99 latency, error rate, and VU count in real time.

---

## Results directory

`load-tests/results/` is the write destination for all k6 JSON and HTML output. It is intentionally **not committed** (only `.gitkeep` is tracked). Do not commit individual result files — they are large and change every run.

Files written here:

| Pattern | Written by |
|---|---|
| `production-latest.json` | `load-test:production`, `load-test:ci` |
| `production-report-<ts>.html` | `load-test:production` |
| `comprehensive-<type>-latest.json` | `load-test:smoke/load/stress/soak` |
| `comparison-load-<ts>.txt` | `load-test:compare` |
| `stellar-write-summary.json` | `stellar-write/Stellar-write.test.js` |
| `<scenario>-<ts>.json` | `run-stellar-load-tests.sh` |

Baselines in `load-tests/baselines/` **should** be committed so the regression comparison works consistently across machines and CI runs.

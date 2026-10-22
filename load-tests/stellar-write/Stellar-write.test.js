/**
 * k6 Load Test: Stellar Blockchain Write Operations
 *
 * Tests concurrent POST /medical-records requests that trigger
 * Stellar transaction anchoring. Measures p50/p95/p99 latency,
 * error rate, and pass/fail against defined SLA thresholds.
 *
 * Run:
 *   k6 run stellar-write.test.js
 *   k6 run --env BASE_URL=http://localhost:3000 --env AUTH_TOKEN=<jwt> stellar-write.test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'testnet-jwt-placeholder';

// ─── Custom Metrics ───────────────────────────────────────────────────────────

// Tracks every medical-record creation end-to-end (DB write + Stellar anchor)
const recordCreationDuration = new Trend('stellar_record_creation_duration', true);

// How many times Stellar submission failed (HTTP 5xx or blockchain error body)
const stellarSubmitErrors    = new Counter('stellar_submit_errors');

// Fraction of requests that surfaced a Stellar-layer error
const stellarErrorRate       = new Rate('stellar_error_rate');

// ─── k6 Options / Scenarios ──────────────────────────────────────────────────

export const options = {
  /**
   * Three scenarios run sequentially so you can observe behaviour at
   * different load levels without manual re-runs:
   *
   *   smoke      – sanity-check (1 VU, 30 s)
   *   ramp_load  – representative production-like load (ramp 1→20 VU over 2 min,
   *                hold 3 min, ramp down 1 min)
   *   stress     – find the breaking point (ramp to 50 VU over 3 min)
   */
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
      startTime: '0s',
    },
    ramp_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 20 }, // warm-up
        { duration: '3m', target: 20 }, // steady state
        { duration: '1m', target: 0  }, // cool-down
      ],
      tags: { scenario: 'ramp_load' },
      startTime: '40s', // after smoke
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '3m', target: 50 }, // aggressive ramp
        { duration: '2m', target: 50 }, // hold
        { duration: '1m', target: 0  }, // tear-down
      ],
      tags: { scenario: 'stress' },
      startTime: '7m40s', // after ramp_load
    },
  },

  // ─── Pass / Fail Thresholds (SLA targets) ──────────────────────────────────
  thresholds: {
    // Overall HTTP success rate must be ≥ 95 %
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],

    // p95 end-to-end record creation (REST + Stellar anchor) ≤ 8 s
    stellar_record_creation_duration: [
      { threshold: 'p(50)<3000',  abortOnFail: false },
      { threshold: 'p(95)<8000',  abortOnFail: false },
      { threshold: 'p(99)<15000', abortOnFail: false },
    ],

    // Stellar-layer errors stay below 5 %
    stellar_error_rate: [{ threshold: 'rate<0.05', abortOnFail: false }],

    // Standard k6 HTTP duration thresholds for quick dashboarding
    http_req_duration: [
      { threshold: 'p(95)<10000', abortOnFail: false },
    ],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns request headers including the auth token */
function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };
}

/** Generates a realistic-looking medical record payload */
function buildMedicalRecordPayload() {
  const patientId  = `patient-${randomIntBetween(1, 500)}`;
  const conditions = [
    'Hypertension', 'Type 2 Diabetes', 'Asthma', 'Chronic Back Pain',
    'Migraine', 'Anxiety Disorder', 'Hypothyroidism', 'GERD',
  ];
  const condition = conditions[randomIntBetween(0, conditions.length - 1)];

  return {
    patientId,
    title:       `${condition} Assessment`,
    recordType:  'consultation',
    chiefComplaint: `Routine follow-up for ${condition}`,
    diagnosis:   condition,
    treatment:   'Medication review and lifestyle counselling',
    notes:       `Patient presents stable. Load-test record created at ${new Date().toISOString()}.`,
    vitals: {
      bloodPressure: `${randomIntBetween(110, 140)}/${randomIntBetween(70, 90)}`,
      heartRate:      randomIntBetween(60, 100),
      temperature:    (36 + Math.random()).toFixed(1),
      weight:         randomIntBetween(55, 110),
    },
    // Signal to the API that Stellar anchoring is expected
    anchorToBlockchain: true,
    metadata: {
      source:      'k6-load-test',
      environment: 'testnet',
    },
  };
}

/**
 * Returns true when the response body contains any Stellar-specific
 * error indicators (submission failure, sequence number mismatch, etc.)
 */
function hasStellarError(res) {
  if (res.status >= 500) return true;
  try {
    const body = res.json();
    const msg  = (body?.message || body?.error || '').toLowerCase();
    return (
      msg.includes('stellar') ||
      msg.includes('transaction') ||
      msg.includes('anchor') ||
      msg.includes('soroban') ||
      msg.includes('sequence') ||
      msg.includes('submission')
    );
  } catch (_) {
    return false;
  }
}

// ─── Default Function (VU entry point) ───────────────────────────────────────

export default function () {
  const url     = `${BASE_URL}/medical-records`;
  const payload = JSON.stringify(buildMedicalRecordPayload());

  group('POST /medical-records → Stellar anchor', () => {
    const start = Date.now();
    const res   = http.post(url, payload, { headers: headers(), timeout: '30s' });
    const took  = Date.now() - start;

    // Record the full round-trip time (REST + blockchain)
    recordCreationDuration.add(took);

    // Detect and track Stellar-layer errors
    const stellarFailed = hasStellarError(res);
    stellarErrorRate.add(stellarFailed ? 1 : 0);
    if (stellarFailed) stellarSubmitErrors.add(1);

    // Assertions – k6 reports these as check pass/fail counts
    check(res, {
      'status is 201 Created':          (r) => r.status === 201,
      'response has record id':         (r) => {
        try { return !!r.json('id'); } catch (_) { return false; }
      },
      'no Stellar submission error':    (_) => !stellarFailed,
      'response time < 15 s':           (_) => took < 15_000,
    });
  });

  // Brief think-time so VUs don't hammer the server in a tight loop
  sleep(randomIntBetween(1, 3));
}

// ─── Teardown Summary ────────────────────────────────────────────────────────

export function handleSummary(data) {
  // Print a human-readable summary to stdout
  return {
    stdout: formatSummary(data),
    'results/stellar-write-summary.json': JSON.stringify(data, null, 2),
  };
}

function formatSummary(data) {
  const m = data.metrics;

  function ms(key, stat) {
    const v = m[key]?.values?.[stat];
    return v !== undefined ? `${v.toFixed(0)} ms` : 'n/a';
  }

  function pct(key) {
    const v = m[key]?.values?.rate;
    return v !== undefined ? `${(v * 100).toFixed(2)} %` : 'n/a';
  }

  return `
╔══════════════════════════════════════════════════════════════════╗
║       Stellar Write Load-Test — Summary                         ║
╚══════════════════════════════════════════════════════════════════╝

  Record creation latency (REST + Stellar anchor)
  ─────────────────────────────────────────────
  p50 : ${ms('stellar_record_creation_duration', 'p(50)')}
  p95 : ${ms('stellar_record_creation_duration', 'p(95)')}
  p99 : ${ms('stellar_record_creation_duration', 'p(99)')}
  max : ${ms('stellar_record_creation_duration', 'max')}

  Reliability
  ─────────────────────────────────────────────
  HTTP error rate     : ${pct('http_req_failed')}
  Stellar error rate  : ${pct('stellar_error_rate')}
  Stellar error count : ${m['stellar_submit_errors']?.values?.count ?? 0}

  Throughput
  ─────────────────────────────────────────────
  Total iterations : ${data.metrics?.iterations?.values?.count ?? 'n/a'}
  Req/s (avg)      : ${data.metrics?.http_reqs?.values?.rate?.toFixed(2) ?? 'n/a'}

Full JSON results written to: results/stellar-write-summary.json
`;
}
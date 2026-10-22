/**
 * k6 Stress Test: Stellar Write Path
 *
 * Ramps to 50 VUs over 3 minutes to find the throughput ceiling and
 * identify where Stellar submission errors begin to appear.
 *
 * Run:
 *   k6 run stress.js
 *   k6 run --env BASE_URL=http://localhost:3000 --env AUTH_TOKEN=<jwt> stress.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'testnet-jwt-placeholder';

const recordCreationDuration = new Trend('stellar_record_creation_duration', true);
const stellarSubmitErrors    = new Counter('stellar_submit_errors');
const stellarErrorRate       = new Rate('stellar_error_rate');

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '3m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 0  },
      ],
    },
  },
  thresholds: {
    // Loosen thresholds for stress – we're looking for the cliff, not SLA
    http_req_failed:                   ['rate<0.20'],
    stellar_record_creation_duration:  ['p(95)<20000'],
    stellar_error_rate:                ['rate<0.20'],
  },
};

function hasStellarError(res) {
  if (res.status >= 500) return true;
  try {
    const msg = (res.json()?.message || res.json()?.error || '').toLowerCase();
    return msg.includes('stellar') || msg.includes('anchor') ||
           msg.includes('transaction') || msg.includes('sequence');
  } catch (_) { return false; }
}

export default function () {
  const payload = JSON.stringify({
    patientId:          `stress-patient-${randomIntBetween(1, 1000)}`,
    title:              'Stress Test Record',
    recordType:         'consultation',
    chiefComplaint:     'Stress test load',
    diagnosis:          'Load Testing Syndrome',
    treatment:          'Horizontal scaling',
    notes:              `Stress iteration at ${new Date().toISOString()}`,
    anchorToBlockchain: true,
    metadata:           { source: 'k6-stress', environment: 'testnet' },
  });

  group('POST /medical-records (stress)', () => {
    const start = Date.now();
    const res   = http.post(`${BASE_URL}/medical-records`, payload, {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      timeout: '45s',
    });
    const took = Date.now() - start;

    recordCreationDuration.add(took);
    const failed = hasStellarError(res);
    stellarErrorRate.add(failed ? 1 : 0);
    if (failed) stellarSubmitErrors.add(1);

    check(res, {
      'stress: status 201':         (r) => r.status === 201,
      'stress: no Stellar error':   (_) => !failed,
      'stress: response < 30 s':    (_) => took < 30_000,
    });
  });

  sleep(randomIntBetween(1, 2));
}
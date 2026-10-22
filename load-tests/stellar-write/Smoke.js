/**
 * k6 Smoke Test: Stellar Write Path
 *
 * Single VU, 30-second run. Confirms the endpoint is reachable and
 * returns a 201 before running the full scenario suite.
 *
 * Run:
 *   k6 run smoke.js
 *   k6 run --env BASE_URL=http://localhost:3000 --env AUTH_TOKEN=<jwt> smoke.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'testnet-jwt-placeholder';

export const options = {
  vus:      1,
  duration: '30s',
  thresholds: {
    http_req_failed:   ['rate<0.01'],  // zero errors allowed in smoke
    http_req_duration: ['p(95)<10000'],
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/medical-records`,
    JSON.stringify({
      patientId:          `smoke-patient-${randomIntBetween(1, 9999)}`,
      title:              'Smoke Test Record',
      recordType:         'consultation',
      chiefComplaint:     'Smoke test',
      diagnosis:          'N/A',
      treatment:          'N/A',
      notes:              `Smoke test at ${new Date().toISOString()}`,
      anchorToBlockchain: true,
      metadata:           { source: 'k6-smoke', environment: 'testnet' },
    }),
    {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      timeout: '30s',
    },
  );

  check(res, {
    'smoke: status 201': (r) => r.status === 201,
    'smoke: has id':     (r) => {
      try { return !!r.json('id'); } catch (_) { return false; }
    },
  });

  sleep(1);
}
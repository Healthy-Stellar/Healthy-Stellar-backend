/**
 * k6 Load Test: 100 Concurrent Patients Reading Records
 *
 * Scenario: Simulate 100 patients simultaneously reading their medical records.
 * Acceptance criteria: p95 latency < 500ms
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { config } from '../config/config.js';
import { checkResponse, thinkTime, parseJSON } from '../utils/helpers.js';

const patientReadDuration = new Trend('patient_read_duration', true);
const patientReadErrors = new Rate('patient_read_errors');

export const options = {
  scenarios: {
    patient_reads: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
      tags: { scenario: 'patient_reads' },
    },
  },
  thresholds: {
    // Acceptance criteria: p95 < 500ms for reads
    'patient_read_duration': ['p(95)<500'],
    'patient_read_errors': ['rate<0.01'],
    'http_req_duration{scenario:patient_reads}': ['p(95)<500'],
    'http_req_failed{scenario:patient_reads}': ['rate<0.01'],
  },
};

export function setup() {
  // Authenticate as admin to get a token for seeding
  const loginRes = http.post(
    `${config.baseUrl}/auth/login`,
    JSON.stringify({
      email: config.testUsers.admin.email,
      password: config.testUsers.admin.password,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status !== 200 && loginRes.status !== 201) {
    console.warn(`Setup login failed (${loginRes.status}), tests will use fallback token`);
    return { token: null, patientIds: [] };
  }

  const body = parseJSON(loginRes);
  const token = body?.access_token || body?.token || null;
  return { token, patientIds: [] };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
  };

  // Read paginated records list
  const listRes = http.get(
    `${config.baseUrl}/records?page=1&limit=10`,
    { headers, tags: { scenario: 'patient_reads', operation: 'list' } },
  );

  const listOk = checkResponse(listRes, 'patient_reads:list', 200);
  patientReadDuration.add(listRes.timings.duration);
  patientReadErrors.add(!listOk);

  // If we got records back, fetch one by ID
  if (listOk) {
    const body = parseJSON(listRes);
    const records = body?.data || body?.records || body || [];
    const items = Array.isArray(records) ? records : [];

    if (items.length > 0) {
      const record = items[Math.floor(Math.random() * items.length)];
      const recordId = record?.id || record?._id;

      if (recordId) {
        const detailRes = http.get(
          `${config.baseUrl}/records/${recordId}`,
          { headers, tags: { scenario: 'patient_reads', operation: 'detail' } },
        );
        const detailOk = checkResponse(detailRes, 'patient_reads:detail', 200);
        patientReadDuration.add(detailRes.timings.duration);
        patientReadErrors.add(!detailOk);
      }
    }
  }

  thinkTime(1, 3);
}

export function teardown(data) {
  console.log('Patient reads scenario complete');
}

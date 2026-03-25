/**
 * k6 Load Test: 50 Concurrent Providers Creating Records
 *
 * Scenario: Simulate 50 healthcare providers simultaneously creating medical records.
 * Acceptance criteria: p95 latency < 2s for writes
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { config } from '../config/config.js';
import {
  checkResponse,
  generatePatientData,
  generateRecordData,
  thinkTime,
  parseJSON,
  randomString,
} from '../utils/helpers.js';

const providerWriteDuration = new Trend('provider_write_duration', true);
const providerWriteErrors = new Rate('provider_write_errors');

export const options = {
  scenarios: {
    provider_writes: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      tags: { scenario: 'provider_writes' },
    },
  },
  thresholds: {
    // Acceptance criteria: p95 < 2s for writes
    'provider_write_duration': ['p(95)<2000'],
    'provider_write_errors': ['rate<0.01'],
    'http_req_duration{scenario:provider_writes}': ['p(95)<2000'],
    'http_req_failed{scenario:provider_writes}': ['rate<0.01'],
  },
};

export function setup() {
  const loginRes = http.post(
    `${config.baseUrl}/auth/login`,
    JSON.stringify({
      email: config.testUsers.doctor.email,
      password: config.testUsers.doctor.password,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status !== 200 && loginRes.status !== 201) {
    console.warn(`Provider login failed (${loginRes.status}), using fallback`);
    return { token: null };
  }

  const body = parseJSON(loginRes);
  return { token: body?.access_token || body?.token || null };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
  };

  // Step 1: Create a patient (or use a known patient ID)
  const patientPayload = generatePatientData();
  const patientRes = http.post(
    `${config.baseUrl}/patients`,
    JSON.stringify(patientPayload),
    { headers, tags: { scenario: 'provider_writes', operation: 'create_patient' } },
  );

  const patientOk = check(patientRes, {
    'provider_writes:create_patient status 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  providerWriteDuration.add(patientRes.timings.duration);
  providerWriteErrors.add(!patientOk);

  // Step 2: Create a medical record for that patient
  const patientBody = parseJSON(patientRes);
  const patientId = patientBody?.id || patientBody?._id || `test-patient-${randomString(8)}`;

  const recordPayload = {
    ...generateRecordData(patientId),
    title: `Record ${randomString(6)}`,
    content: `Medical notes ${randomString(20)}`,
  };

  const recordRes = http.post(
    `${config.baseUrl}/records`,
    JSON.stringify(recordPayload),
    { headers, tags: { scenario: 'provider_writes', operation: 'create_record' } },
  );

  const recordOk = check(recordRes, {
    'provider_writes:create_record status 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  providerWriteDuration.add(recordRes.timings.duration);
  providerWriteErrors.add(!recordOk);

  thinkTime(2, 5);
}

export function teardown(data) {
  console.log('Provider writes scenario complete');
}

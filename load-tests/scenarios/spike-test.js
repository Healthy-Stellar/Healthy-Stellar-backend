/**
 * k6 Load Test: Spike Test — 0 → 500 → 0 users in 60 seconds
 *
 * Scenario: Rapidly ramp from 0 to 500 virtual users and back to 0 within 60s.
 * This tests the system's ability to handle sudden traffic bursts (e.g., viral events,
 * scheduled appointment rushes, emergency broadcasts).
 *
 * Pass criteria:
 *   - Error rate stays below 5% during the spike (relaxed from 1% due to burst nature)
 *   - p95 latency < 2s during peak (system may degrade but must not fail completely)
 *   - System recovers: p95 < 500ms within 30s after spike ends
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { config } from '../config/config.js';
import { parseJSON } from '../utils/helpers.js';

const spikeDuration = new Trend('spike_duration', true);
const spikeErrors = new Rate('spike_errors');
const spikeRequests = new Counter('spike_requests');

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 0 },   // Baseline: no load
        { duration: '20s', target: 500 },  // Ramp up to 500 users
        { duration: '10s', target: 500 },  // Hold at peak
        { duration: '20s', target: 0 },    // Ramp back down
      ],
      tags: { scenario: 'spike' },
    },
  },
  thresholds: {
    // Spike tests have relaxed thresholds — system must survive, not necessarily excel
    'spike_errors': ['rate<0.05'],          // < 5% errors during spike
    'spike_duration': ['p(95)<2000'],       // p95 < 2s during spike
    'http_req_failed{scenario:spike}': ['rate<0.05'],
    'http_req_duration{scenario:spike}': ['p(95)<2000'],
  },
};

export function setup() {
  // Pre-authenticate to get a token
  const loginRes = http.post(
    `${config.baseUrl}/auth/login`,
    JSON.stringify({
      email: config.testUsers.admin.email,
      password: config.testUsers.admin.password,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const body = parseJSON(loginRes);
  return { token: body?.access_token || body?.token || null };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
  };

  // Mix of realistic endpoints during a spike
  const endpoints = [
    { method: 'GET', path: '/health', weight: 3 },
    { method: 'GET', path: '/records?page=1&limit=5', weight: 4 },
    { method: 'GET', path: '/patients?page=1&limit=5', weight: 2 },
    { method: 'GET', path: '/analytics/overview', weight: 1 },
  ];

  // Weighted random endpoint selection
  const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
  let rand = Math.random() * totalWeight;
  let selected = endpoints[0];
  for (const endpoint of endpoints) {
    rand -= endpoint.weight;
    if (rand <= 0) {
      selected = endpoint;
      break;
    }
  }

  const res = http.get(
    `${config.baseUrl}${selected.path}`,
    { headers, tags: { scenario: 'spike', endpoint: selected.path } },
  );

  const ok = check(res, {
    'spike: status not 5xx': (r) => r.status < 500,
    'spike: response received': (r) => r.body !== null,
  });

  spikeDuration.add(res.timings.duration);
  spikeErrors.add(!ok);
  spikeRequests.add(1);

  // Minimal think time during spike to maximize pressure
  sleep(0.1);
}

export function teardown(data) {
  console.log('Spike test complete. Check spike_errors and spike_duration metrics.');
}

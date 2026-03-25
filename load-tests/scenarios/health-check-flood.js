/**
 * k6 Load Test: 200 Concurrent Health Check Requests
 *
 * Scenario: Simulate 200 concurrent requests to the health check endpoint.
 * Health checks should be extremely fast — p95 < 100ms.
 */

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { config } from '../config/config.js';

const healthCheckDuration = new Trend('health_check_duration', true);
const healthCheckErrors = new Rate('health_check_errors');

export const options = {
  scenarios: {
    health_checks: {
      executor: 'constant-vus',
      vus: 200,
      duration: '3m',
      tags: { scenario: 'health_checks' },
    },
  },
  thresholds: {
    'health_check_duration': ['p(95)<100'],
    'health_check_errors': ['rate<0.001'],
    'http_req_duration{scenario:health_checks}': ['p(95)<100'],
    'http_req_failed{scenario:health_checks}': ['rate<0.001'],
  },
};

export default function () {
  const res = http.get(
    `${config.baseUrl}/health`,
    { tags: { scenario: 'health_checks' } },
  );

  const ok = check(res, {
    'health_check: status 200': (r) => r.status === 200,
    'health_check: response time < 500ms': (r) => r.timings.duration < 500,
    'health_check: has status field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body?.status !== undefined;
      } catch {
        return false;
      }
    },
  });

  healthCheckDuration.add(res.timings.duration);
  healthCheckErrors.add(!ok);

  // No sleep — health checks are polled rapidly in production
}

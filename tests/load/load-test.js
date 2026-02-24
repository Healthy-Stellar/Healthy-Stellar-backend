import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<50'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const headers = AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {};

export default function () {
  const auditRes = http.get(`${BASE_URL}/medical-rbac/audit-logs?page=1&limit=20`, {
    headers,
  });
  check(auditRes, {
    'audit logs status 200': (r) => r.status === 200,
  });

  const patientRes = http.get(`${BASE_URL}/patients?search=`, { headers });
  check(patientRes, {
    'patients status 200': (r) => r.status === 200,
  });

  sleep(1);
}

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

  // Test 3: Health records endpoint
  const healthRecordsRes = http.get(`${BASE_URL}/health-records?page=1&limit=10`, {
    headers,
  });
  check(healthRecordsRes, {
    'health records status 200': (r) => r.status === 200,
    'health records response time OK': (r) => r.timings.duration < 500,
  });

  // Test 4: User profile endpoint
  const profileRes = http.get(`${BASE_URL}/users/profile`, { headers });
  check(profileRes, {
    'user profile status 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  // Test 5: Medical RBAC roles endpoint
  const rolesRes = http.get(`${BASE_URL}/medical-rbac/roles`, { headers });
  check(rolesRes, {
    'roles status 200': (r) => r.status === 200,
    'roles has response body': (r) => r.body.length > 0,
  });

  // Test 6: Health metrics endpoint
  const metricsRes = http.get(`${BASE_URL}/health`, { headers: {} });
  check(metricsRes, {
    'health check status 200': (r) => r.status === 200,
    'health check fast response': (r) => r.timings.duration < 200,
  });

  // Test 7: Medical RBAC permissions endpoint
  const permissionsRes = http.get(`${BASE_URL}/medical-rbac/permissions?page=1&limit=20`, {
    headers,
  });
  check(permissionsRes, {
    'permissions status 200': (r) => r.status === 200,
    'permissions valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        return false;
      }
    },
  });

  // Test 8: Search patients with query
  const searchRes = http.get(`${BASE_URL}/patients?search=test&page=1&limit=10`, {
    headers,
  });
  check(searchRes, {
    'patient search status 200': (r) => r.status === 200,
    'search response time acceptable': (r) => r.timings.duration < 1000,
  });

  // Test 9: Appointments endpoint
  const appointmentsRes = http.get(`${BASE_URL}/appointments?status=pending`, {
    headers,
  });
  check(appointmentsRes, {
    'appointments status 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  // Test 10: Medical records by patient ID (simulate with ID 1)
  const patientRecordsRes = http.get(`${BASE_URL}/health-records/patient/1`, {
    headers,
  });
  check(patientRecordsRes, {
    'patient records status 200 or 404': (r) => r.status === 200 || r.status === 404,
    'patient records response not empty': (r) => r.body !== null,
  });

  sleep(1);
}

/**
 * k6 Load Test: Access Grant/Revoke
 * 
 * Tests access control operations (grant and revoke)
 * Target: 200 concurrent operations
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config, getThresholds } from '../config/config.js';
import {
  checkResponse,
  accessGrantDuration,
  generatePatientData,
  generateRecordData,
  randomEmail,
  thinkTime,
  parseJSON,
} from '../utils/helpers.js';

// Test configuration
export const options = {
  scenarios: {
    access_smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
      exec: 'accessControl',
    },
    access_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'load' },
      exec: 'accessControl',
    },
  },
  thresholds: getThresholds(),
};

/**
 * Setup function
 */
export function setup() {
  console.log('Starting Access Control Load Test');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Target: 200 concurrent operations`);

  const baseUrl = config.baseUrl;

  // Login as admin
  const loginPayload = JSON.stringify({
    email: config.testUsers.admin.email,
    password: config.testUsers.admin.password,
  });

  const loginResponse = http.post(
    `${baseUrl}/auth/login`,
    loginPayload,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  let adminToken = null;
  if (loginResponse.status === 200) {
    const data = parseJSON(loginResponse);
    adminToken = data ? data.accessToken : null;
  }

  if (!adminToken) {
    console.error('Failed to get admin token');
    return { baseUrl, adminToken: null, patientId: null, recordIds: [], doctorIds: [] };
  }

  // Create test patient
  const patientData = generatePatientData();
  const patientResponse = http.post(
    `${baseUrl}/patients`,
    JSON.stringify(patientData),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
    }
  );

  let patientId = null;
  if (patientResponse.status === 201) {
    const data = parseJSON(patientResponse);
    patientId = data ? data.id : null;
  }

  if (!patientId) {
    console.error('Failed to create patient');
    return { baseUrl, adminToken, patientId: null, recordIds: [], doctorIds: [] };
  }

  // Create test records
  const recordIds = [];
  for (let i = 0; i < 5; i++) {
    const recordData = generateRecordData(patientId);
    
    const recordResponse = http.post(
      `${baseUrl}/records/simple`,
      JSON.stringify(recordData),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
      }
    );

    if (recordResponse.status === 201) {
      const data = parseJSON(recordResponse);
      if (data && data.recordId) {
        recordIds.push(data.recordId);
      }
    }
  }

  // Create test doctors
  const doctorIds = [];
  for (let i = 0; i < 3; i++) {
    const doctorData = {
      email: randomEmail(),
      password: 'Doctor123!@#',
      firstName: `Doctor${i}`,
      lastName: 'Test',
      role: 'DOCTOR',
    };

    const doctorResponse = http.post(
      `${baseUrl}/auth/register`,
      JSON.stringify(doctorData),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (doctorResponse.status === 201) {
      const data = parseJSON(doctorResponse);
      if (data && data.userId) {
        doctorIds.push(data.userId);
      }
    }
  }

  console.log(`Created ${recordIds.length} records and ${doctorIds.length} doctors`);

  return {
    baseUrl: baseUrl,
    adminToken: adminToken,
    patientId: patientId,
    recordIds: recordIds,
    doctorIds: doctorIds,
  };
}

/**
 * Main test function - Access Control
 */
export function accessControl(data) {
  if (!data.adminToken || data.recordIds.length === 0 || data.doctorIds.length === 0) {
    console.error('Missing required test data');
    return;
  }

  const baseUrl = data.baseUrl;
  const token = data.adminToken;
  const recordIds = data.recordIds;
  const doctorIds = data.doctorIds;

  // Randomly select record and doctor
  const recordId = recordIds[Math.floor(Math.random() * recordIds.length)];
  const doctorId = doctorIds[Math.floor(Math.random() * doctorIds.length)];

  // Step 1: Grant access
  const grantStart = Date.now();

  const grantPayload = JSON.stringify({
    recordId: recordId,
    grantedTo: doctorId,
    permissions: ['READ', 'WRITE'],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  });

  const grantParams = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'access_grant', scenario: 'access_grant' },
  };

  const grantResponse = http.post(
    `${baseUrl}/access/grant`,
    grantPayload,
    grantParams
  );

  const grantSuccess = checkResponse(grantResponse, 'Grant Access', 201);

  let accessId = null;
  if (grantSuccess) {
    const grantDuration = Date.now() - grantStart;
    accessGrantDuration.add(grantDuration);

    const grantData = parseJSON(grantResponse);
    accessId = grantData ? grantData.accessId : null;
  }

  thinkTime(1, 2);

  // Step 2: Verify access
  if (accessId) {
    const verifyParams = {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      tags: { name: 'access_verify', scenario: 'access_grant' },
    };

    const verifyResponse = http.get(
      `${baseUrl}/access/${accessId}`,
      verifyParams
    );

    checkResponse(verifyResponse, 'Verify Access', 200);

    thinkTime(1, 2);
  }

  // Step 3: List access grants for record
  const listParams = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'access_list', scenario: 'access_grant' },
  };

  const listResponse = http.get(
    `${baseUrl}/access/record/${recordId}`,
    listParams
  );

  checkResponse(listResponse, 'List Access', 200);

  thinkTime(1, 2);

  // Step 4: Revoke access
  if (accessId) {
    const revokeStart = Date.now();

    const revokeParams = {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      tags: { name: 'access_revoke', scenario: 'access_grant' },
    };

    const revokeResponse = http.del(
      `${baseUrl}/access/${accessId}`,
      null,
      revokeParams
    );

    const revokeSuccess = checkResponse(revokeResponse, 'Revoke Access', 200);

    if (revokeSuccess) {
      const revokeDuration = Date.now() - revokeStart;
      accessGrantDuration.add(revokeDuration);
    }

    thinkTime(1, 2);

    // Verify revocation
    const verifyRevokeParams = {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      tags: { name: 'access_verify_revoked', scenario: 'access_grant' },
    };

    const verifyRevokeResponse = http.get(
      `${baseUrl}/access/${accessId}`,
      verifyRevokeParams
    );

    // Should return 404 or show as revoked
    check(verifyRevokeResponse, {
      'access revoked': (r) => r.status === 404 || (r.status === 200 && parseJSON(r)?.isActive === false),
    });
  }

  thinkTime(2, 5);
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log('Access Control Load Test Complete');
}

/**
 * Handle summary
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-tests/results/access-control-summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  
  let summary = '\n' + indent + '=== Access Control Load Test Summary ===\n\n';
  
  if (data.metrics.http_reqs) {
    summary += indent + `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  }
  
  if (data.metrics.http_req_duration) {
    summary += indent + `Request Duration:\n`;
    summary += indent + `  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += indent + `  P95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += indent + `  P99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  }
  
  if (data.metrics.http_req_failed) {
    const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
    summary += indent + `Failed Requests: ${failRate}%\n`;
  }
  
  if (data.metrics.access_grant_duration) {
    summary += indent + `\nAccess Grant/Revoke Duration:\n`;
    summary += indent + `  Avg: ${data.metrics.access_grant_duration.values.avg.toFixed(2)}ms\n`;
    summary += indent + `  P95: ${data.metrics.access_grant_duration.values['p(95)'].toFixed(2)}ms\n`;
  }
  
  summary += indent + '\n========================================\n';
  
  return summary;
}

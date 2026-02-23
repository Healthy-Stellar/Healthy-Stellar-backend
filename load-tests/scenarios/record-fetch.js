/**
 * k6 Load Test: Record Fetch with Access Check
 * 
 * Tests medical record retrieval with access control validation
 * Target: 1000 concurrent reads
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config, getThresholds } from '../config/config.js';
import {
  checkResponse,
  recordFetchDuration,
  generatePatientData,
  generateRecordData,
  thinkTime,
  parseJSON,
} from '../utils/helpers.js';

// Test configuration
export const options = {
  scenarios: {
    fetch_smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
      exec: 'recordFetch',
    },
    fetch_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '5m', target: 1000 },
        { duration: '2m', target: 1000 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'load' },
      exec: 'recordFetch',
    },
  },
  thresholds: getThresholds(),
};

/**
 * Setup function
 */
export function setup() {
  console.log('Starting Record Fetch Load Test');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Target: 1000 concurrent reads`);

  const baseUrl = config.baseUrl;

  // Login as doctor
  const loginPayload = JSON.stringify({
    email: config.testUsers.doctor.email,
    password: config.testUsers.doctor.password,
  });

  const loginResponse = http.post(
    `${baseUrl}/auth/login`,
    loginPayload,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  let token = null;
  if (loginResponse.status === 200) {
    const data = parseJSON(loginResponse);
    token = data ? data.accessToken : null;
  }

  if (!token) {
    console.error('Failed to get auth token');
    return { baseUrl, token: null, recordIds: [] };
  }

  // Create test patient
  const patientData = generatePatientData();
  const patientResponse = http.post(
    `${baseUrl}/patients`,
    JSON.stringify(patientData),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    return { baseUrl, token, recordIds: [] };
  }

  // Create multiple test records
  const recordIds = [];
  for (let i = 0; i < 10; i++) {
    const recordData = generateRecordData(patientId);
    
    // Simplified record creation without file
    const recordResponse = http.post(
      `${baseUrl}/records/simple`,
      JSON.stringify(recordData),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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

  console.log(`Created ${recordIds.length} test records`);

  return {
    baseUrl: baseUrl,
    token: token,
    patientId: patientId,
    recordIds: recordIds,
  };
}

/**
 * Main test function - Record Fetch
 */
export function recordFetch(data) {
  if (!data.token || data.recordIds.length === 0) {
    console.error('Missing token or recordIds');
    return;
  }

  const baseUrl = data.baseUrl;
  const token = data.token;
  const recordIds = data.recordIds;

  // Randomly select a record to fetch
  const recordId = recordIds[Math.floor(Math.random() * recordIds.length)];

  const fetchStart = Date.now();

  // Fetch single record
  const fetchParams = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'record_fetch_single', scenario: 'record_fetch' },
  };

  const fetchResponse = http.get(
    `${baseUrl}/records/${recordId}`,
    fetchParams
  );

  const fetchSuccess = checkResponse(fetchResponse, 'Fetch Single', 200);

  if (fetchSuccess) {
    const fetchDuration = Date.now() - fetchStart;
    recordFetchDuration.add(fetchDuration);
  }

  thinkTime(0.5, 1);

  // Fetch records list with pagination
  const listStart = Date.now();

  const listParams = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'record_fetch_list', scenario: 'record_fetch' },
  };

  const listResponse = http.get(
    `${baseUrl}/records?page=1&limit=20&patientId=${data.patientId}`,
    listParams
  );

  const listSuccess = checkResponse(listResponse, 'Fetch List', 200);

  if (listSuccess) {
    const listDuration = Date.now() - listStart;
    recordFetchDuration.add(listDuration);

    // Verify pagination structure
    const listData = parseJSON(listResponse);
    if (listData) {
      check(listData, {
        'has data array': (d) => Array.isArray(d.data),
        'has meta object': (d) => d.meta && typeof d.meta === 'object',
        'has total count': (d) => typeof d.meta.total === 'number',
      });
    }
  }

  thinkTime(0.5, 1);

  // Fetch with filters
  const filterStart = Date.now();

  const filterParams = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    tags: { name: 'record_fetch_filtered', scenario: 'record_fetch' },
  };

  const filterResponse = http.get(
    `${baseUrl}/records?recordType=MEDICAL_REPORT&sortBy=createdAt&order=desc`,
    filterParams
  );

  checkResponse(filterResponse, 'Fetch Filtered', 200);

  thinkTime(1, 2);
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log('Record Fetch Load Test Complete');
}

/**
 * Handle summary
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-tests/results/record-fetch-summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  
  let summary = '\n' + indent + '=== Record Fetch Load Test Summary ===\n\n';
  
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
  
  if (data.metrics.record_fetch_duration) {
    summary += indent + `\nFetch Duration:\n`;
    summary += indent + `  Avg: ${data.metrics.record_fetch_duration.values.avg.toFixed(2)}ms\n`;
    summary += indent + `  P95: ${data.metrics.record_fetch_duration.values['p(95)'].toFixed(2)}ms\n`;
  }
  
  if (data.metrics.data_received) {
    const dataReceivedMB = (data.metrics.data_received.values.count / 1024 / 1024).toFixed(2);
    summary += indent + `\nData Received: ${dataReceivedMB} MB\n`;
  }
  
  summary += indent + '\n=======================================\n';
  
  return summary;
}

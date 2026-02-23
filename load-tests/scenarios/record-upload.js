/**
 * k6 Load Test: Record Upload
 * 
 * Tests medical record upload with file attachment
 * Target: 100 concurrent uploads
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { FormData } from 'https://jslib.k6.io/formdata/0.0.2/index.js';
import { config, getThresholds } from '../config/config.js';
import {
  checkResponse,
  recordUploadDuration,
  generatePatientData,
  generateRecordData,
  generateMockFile,
  thinkTime,
  parseJSON,
} from '../utils/helpers.js';

// Test configuration
export const options = {
  scenarios: {
    upload_smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
      exec: 'recordUpload',
    },
    upload_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'load' },
      exec: 'recordUpload',
    },
  },
  thresholds: getThresholds(),
};

/**
 * Setup function
 */
export function setup() {
  console.log('Starting Record Upload Load Test');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Target: 100 concurrent uploads`);

  // Create test user and get auth token
  const baseUrl = config.baseUrl;
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

  // Create test patient
  let patientId = null;
  if (token) {
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

    if (patientResponse.status === 201) {
      const data = parseJSON(patientResponse);
      patientId = data ? data.id : null;
    }
  }

  return {
    baseUrl: baseUrl,
    token: token,
    patientId: patientId,
  };
}

/**
 * Main test function - Record Upload
 */
export function recordUpload(data) {
  if (!data.token || !data.patientId) {
    console.error('Missing token or patientId');
    return;
  }

  const baseUrl = data.baseUrl;
  const token = data.token;
  const patientId = data.patientId;

  // Generate record data
  const recordData = generateRecordData(patientId);
  
  // Generate mock file (100KB)
  const fileContent = generateMockFile(100);

  const uploadStart = Date.now();

  // Create multipart form data
  const formData = new FormData();
  formData.append('patientId', recordData.patientId);
  formData.append('recordType', recordData.recordType);
  formData.append('description', recordData.description);
  formData.append('metadata', JSON.stringify(recordData.metadata));
  formData.append('file', http.file(fileContent, 'medical-record.pdf', 'application/pdf'));

  const uploadParams = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data; boundary=' + formData.boundary,
    },
    tags: { name: 'record_upload', scenario: 'record_upload' },
    timeout: '30s',
  };

  const uploadResponse = http.post(
    `${baseUrl}/records`,
    formData.body(),
    uploadParams
  );

  const uploadSuccess = checkResponse(uploadResponse, 'Upload', 201);

  if (uploadSuccess) {
    const uploadDuration = Date.now() - uploadStart;
    recordUploadDuration.add(uploadDuration);

    const responseData = parseJSON(uploadResponse);
    if (responseData && responseData.recordId) {
      // Verify upload by fetching the record
      thinkTime(1, 2);

      const fetchParams = {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'record_verify', scenario: 'record_upload' },
      };

      const fetchResponse = http.get(
        `${baseUrl}/records/${responseData.recordId}`,
        fetchParams
      );

      checkResponse(fetchResponse, 'Verify Upload', 200);
    }
  }

  thinkTime(2, 5);
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log('Record Upload Load Test Complete');
}

/**
 * Handle summary
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-tests/results/record-upload-summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  
  let summary = '\n' + indent + '=== Record Upload Load Test Summary ===\n\n';
  
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
  
  if (data.metrics.record_upload_duration) {
    summary += indent + `\nUpload Duration:\n`;
    summary += indent + `  Avg: ${data.metrics.record_upload_duration.values.avg.toFixed(2)}ms\n`;
    summary += indent + `  P95: ${data.metrics.record_upload_duration.values['p(95)'].toFixed(2)}ms\n`;
  }
  
  if (data.metrics.data_sent) {
    const dataSentMB = (data.metrics.data_sent.values.count / 1024 / 1024).toFixed(2);
    summary += indent + `\nData Sent: ${dataSentMB} MB\n`;
  }
  
  summary += indent + '\n========================================\n';
  
  return summary;
}

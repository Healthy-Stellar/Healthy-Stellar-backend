/**
 * k6 Load Testing Helper Functions
 */

import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const authDuration = new Trend('auth_duration');
export const recordUploadDuration = new Trend('record_upload_duration');
export const recordFetchDuration = new Trend('record_fetch_duration');
export const accessGrantDuration = new Trend('access_grant_duration');
export const successfulRequests = new Counter('successful_requests');
export const failedRequests = new Counter('failed_requests');

/**
 * Generate random string
 */
export function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random email
 */
export function randomEmail() {
  return `test-${randomString(8)}@example.com`;
}

/**
 * Generate random patient data
 */
export function generatePatientData() {
  return {
    firstName: `Patient${randomString(5)}`,
    lastName: `Test${randomString(5)}`,
    dateOfBirth: '1990-01-01',
    gender: 'M',
    email: randomEmail(),
    phone: '+1234567890',
    nationalId: `SSN-${Math.floor(Math.random() * 1000000000)}`,
    nationalIdType: 'SSN',
  };
}

/**
 * Generate random record data
 */
export function generateRecordData(patientId) {
  return {
    patientId: patientId,
    recordType: ['MEDICAL_REPORT', 'LAB_RESULT', 'IMAGING', 'PRESCRIPTION'][
      Math.floor(Math.random() * 4)
    ],
    description: `Test record ${randomString(10)}`,
    metadata: {
      facility: 'Test Hospital',
      department: 'Cardiology',
    },
  };
}

/**
 * Generate mock file content
 */
export function generateMockFile(sizeKB = 100) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const size = sizeKB * 1024;
  let content = '';
  
  for (let i = 0; i < size; i++) {
    content += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return content;
}

/**
 * Check response and record metrics
 */
export function checkResponse(response, scenario, expectedStatus = 200) {
  const success = check(response, {
    [`${scenario}: status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${scenario}: response has body`]: (r) => r.body && r.body.length > 0,
    [`${scenario}: response time < 5s`]: (r) => r.timings.duration < 5000,
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    console.error(`${scenario} failed:`, {
      status: response.status,
      body: response.body ? response.body.substring(0, 200) : 'No body',
      duration: response.timings.duration,
    });
  }

  return success;
}

/**
 * Record custom metric
 */
export function recordMetric(metric, value) {
  metric.add(value);
}

/**
 * Sleep with random jitter
 */
export function sleepRandom(min = 1, max = 3) {
  const duration = min + Math.random() * (max - min);
  sleep(duration);
}

/**
 * Think time - simulate user reading/thinking
 */
export function thinkTime(min = 1, max = 5) {
  sleepRandom(min, max);
}

/**
 * Parse JSON response safely
 */
export function parseJSON(response) {
  try {
    return JSON.parse(response.body);
  } catch (e) {
    console.error('Failed to parse JSON:', response.body);
    return null;
  }
}

/**
 * Create multipart form data
 */
export function createMultipartFormData(fields, file) {
  const boundary = `----k6Boundary${randomString(16)}`;
  let body = '';

  // Add fields
  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
    body += `${value}\r\n`;
  }

  // Add file
  if (file) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${file.name}"\r\n`;
    body += `Content-Type: ${file.type}\r\n\r\n`;
    body += `${file.content}\r\n`;
  }

  body += `--${boundary}--\r\n`;

  return {
    body: body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

/**
 * Retry request on failure
 */
export function retryRequest(requestFn, maxRetries = 3, delayMs = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = requestFn();
      if (response.status >= 200 && response.status < 300) {
        return response;
      }
      lastError = new Error(`Request failed with status ${response.status}`);
    } catch (e) {
      lastError = e;
    }
    
    if (i < maxRetries - 1) {
      sleep(delayMs / 1000);
    }
  }
  
  throw lastError;
}

/**
 * Calculate percentile from array of values
 */
export function percentile(values, p) {
  if (values.length === 0) return 0;
  
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Log test summary
 */
export function logSummary(data) {
  console.log('\n=== Test Summary ===');
  console.log(`Total Requests: ${data.totalRequests}`);
  console.log(`Successful: ${data.successful}`);
  console.log(`Failed: ${data.failed}`);
  console.log(`Error Rate: ${((data.failed / data.totalRequests) * 100).toFixed(2)}%`);
  console.log(`Avg Duration: ${formatDuration(data.avgDuration)}`);
  console.log(`P95 Duration: ${formatDuration(data.p95Duration)}`);
  console.log(`P99 Duration: ${formatDuration(data.p99Duration)}`);
  console.log('===================\n');
}

/**
 * Validate baseline comparison
 */
export function compareWithBaseline(current, baseline, tolerance = 0.20) {
  const results = {
    passed: true,
    regressions: [],
  };

  const metrics = ['p95', 'p99', 'avg'];
  
  for (const metric of metrics) {
    const currentValue = current[metric];
    const baselineValue = baseline[metric];
    const threshold = baselineValue * (1 + tolerance);
    
    if (currentValue > threshold) {
      results.passed = false;
      results.regressions.push({
        metric,
        current: currentValue,
        baseline: baselineValue,
        threshold,
        regression: ((currentValue - baselineValue) / baselineValue * 100).toFixed(2) + '%',
      });
    }
  }

  return results;
}

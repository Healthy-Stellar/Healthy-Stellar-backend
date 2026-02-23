/**
 * k6 Comprehensive Load Test Suite
 * 
 * Runs all test scenarios with different test types:
 * - Smoke test: Minimal load to verify functionality
 * - Load test: Expected production load
 * - Stress test: Beyond normal load to find breaking points
 * - Soak test: Extended duration to find memory leaks
 */

import { group } from 'k6';
import { config, getThresholds, getScenario } from './config/config.js';
import * as authFlow from './scenarios/auth-flow.js';
import * as recordUpload from './scenarios/record-upload.js';
import * as recordFetch from './scenarios/record-fetch.js';
import * as accessControl from './scenarios/access-control.js';

// Get test type from environment variable
const TEST_TYPE = __ENV.TEST_TYPE || 'smoke';

// Configure scenarios based on test type
export const options = {
  scenarios: getScenarios(TEST_TYPE),
  thresholds: getThresholds(),
};

/**
 * Get scenario configuration based on test type
 */
function getScenarios(testType) {
  const baseScenarios = {
    smoke: {
      auth: {
        executor: 'constant-vus',
        vus: 1,
        duration: '1m',
        exec: 'testAuth',
        tags: { test_type: 'smoke', scenario: 'auth' },
      },
      upload: {
        executor: 'constant-vus',
        vus: 1,
        duration: '1m',
        exec: 'testUpload',
        tags: { test_type: 'smoke', scenario: 'upload' },
      },
      fetch: {
        executor: 'constant-vus',
        vus: 1,
        duration: '1m',
        exec: 'testFetch',
        tags: { test_type: 'smoke', scenario: 'fetch' },
      },
      access: {
        executor: 'constant-vus',
        vus: 1,
        duration: '1m',
        exec: 'testAccess',
        tags: { test_type: 'smoke', scenario: 'access' },
      },
    },
    load: {
      auth: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '2m', target: 100 },
          { duration: '5m', target: 500 },
          { duration: '2m', target: 500 },
          { duration: '2m', target: 0 },
        ],
        exec: 'testAuth',
        tags: { test_type: 'load', scenario: 'auth' },
      },
      upload: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '2m', target: 20 },
          { duration: '5m', target: 100 },
          { duration: '2m', target: 100 },
          { duration: '2m', target: 0 },
        ],
        exec: 'testUpload',
        tags: { test_type: 'load', scenario: 'upload' },
      },
      fetch: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '2m', target: 200 },
          { duration: '5m', target: 1000 },
          { duration: '2m', target: 1000 },
          { duration: '2m', target: 0 },
        ],
        exec: 'testFetch',
        tags: { test_type: 'load', scenario: 'fetch' },
      },
      access: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '2m', target: 50 },
          { duration: '5m', target: 200 },
          { duration: '2m', target: 200 },
          { duration: '2m', target: 0 },
        ],
        exec: 'testAccess',
        tags: { test_type: 'load', scenario: 'access' },
      },
    },
    stress: {
      auth: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '2m', target: 500 },
          { duration: '5m', target: 500 },
          { duration: '2m', target: 1000 },
          { duration: '5m', target: 1000 },
          { duration: '2m', target: 1500 },
          { duration: '5m', target: 1500 },
          { duration: '5m', target: 0 },
        ],
        exec: 'testAuth',
        tags: { test_type: 'stress', scenario: 'auth' },
      },
      upload: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '2m', target: 100 },
          { duration: '5m', target: 100 },
          { duration: '2m', target: 200 },
          { duration: '5m', target: 200 },
          { duration: '2m', target: 300 },
          { duration: '5m', target: 300 },
          { duration: '5m', target: 0 },
        ],
        exec: 'testUpload',
        tags: { test_type: 'stress', scenario: 'upload' },
      },
      fetch: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '2m', target: 1000 },
          { duration: '5m', target: 1000 },
          { duration: '2m', target: 2000 },
          { duration: '5m', target: 2000 },
          { duration: '2m', target: 3000 },
          { duration: '5m', target: 3000 },
          { duration: '5m', target: 0 },
        ],
        exec: 'testFetch',
        tags: { test_type: 'stress', scenario: 'fetch' },
      },
      access: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '2m', target: 200 },
          { duration: '5m', target: 200 },
          { duration: '2m', target: 400 },
          { duration: '5m', target: 400 },
          { duration: '2m', target: 600 },
          { duration: '5m', target: 600 },
          { duration: '5m', target: 0 },
        ],
        exec: 'testAccess',
        tags: { test_type: 'stress', scenario: 'access' },
      },
    },
    soak: {
      auth: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '5m', target: 250 },
          { duration: '3h', target: 250 },
          { duration: '5m', target: 0 },
        ],
        exec: 'testAuth',
        tags: { test_type: 'soak', scenario: 'auth' },
      },
      upload: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '5m', target: 50 },
          { duration: '3h', target: 50 },
          { duration: '5m', target: 0 },
        ],
        exec: 'testUpload',
        tags: { test_type: 'soak', scenario: 'upload' },
      },
      fetch: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '5m', target: 500 },
          { duration: '3h', target: 500 },
          { duration: '5m', target: 0 },
        ],
        exec: 'testFetch',
        tags: { test_type: 'soak', scenario: 'fetch' },
      },
      access: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '5m', target: 100 },
          { duration: '3h', target: 100 },
          { duration: '5m', target: 0 },
        ],
        exec: 'testAccess',
        tags: { test_type: 'soak', scenario: 'access' },
      },
    },
  };

  return baseScenarios[testType] || baseScenarios.smoke;
}

/**
 * Setup function
 */
export function setup() {
  console.log(`\n=== Starting Comprehensive Load Test ===`);
  console.log(`Test Type: ${TEST_TYPE}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`========================================\n`);

  // Setup for each scenario
  const authSetup = authFlow.setup();
  const uploadSetup = recordUpload.setup();
  const fetchSetup = recordFetch.setup();
  const accessSetup = accessControl.setup();

  return {
    auth: authSetup,
    upload: uploadSetup,
    fetch: fetchSetup,
    access: accessSetup,
  };
}

/**
 * Test functions for each scenario
 */
export function testAuth(data) {
  group('Auth Flow', () => {
    authFlow.authFlow(data.auth);
  });
}

export function testUpload(data) {
  group('Record Upload', () => {
    recordUpload.recordUpload(data.upload);
  });
}

export function testFetch(data) {
  group('Record Fetch', () => {
    recordFetch.recordFetch(data.fetch);
  });
}

export function testAccess(data) {
  group('Access Control', () => {
    accessControl.accessControl(data.access);
  });
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log(`\n=== Comprehensive Load Test Complete ===`);
  console.log(`Test Type: ${TEST_TYPE}`);
  console.log(`========================================\n`);
}

/**
 * Handle summary
 */
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return {
    'stdout': generateTextSummary(data),
    [`load-tests/results/comprehensive-${TEST_TYPE}-${timestamp}.json`]: JSON.stringify(data, null, 2),
    [`load-tests/results/comprehensive-${TEST_TYPE}-latest.json`]: JSON.stringify(data, null, 2),
  };
}

/**
 * Generate text summary
 */
function generateTextSummary(data) {
  let summary = '\n';
  summary += '╔════════════════════════════════════════════════════════════╗\n';
  summary += '║       Comprehensive Load Test Summary                     ║\n';
  summary += '╚════════════════════════════════════════════════════════════╝\n\n';

  summary += `Test Type: ${TEST_TYPE}\n`;
  summary += `Duration: ${(data.state.testRunDurationMs / 1000 / 60).toFixed(2)} minutes\n\n`;

  // Overall metrics
  summary += '─────────────────────────────────────────────────────────────\n';
  summary += 'Overall Metrics:\n';
  summary += '─────────────────────────────────────────────────────────────\n';

  if (data.metrics.http_reqs) {
    summary += `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  }

  if (data.metrics.http_req_duration) {
    summary += `Request Duration:\n`;
    summary += `  Min: ${data.metrics.http_req_duration.values.min.toFixed(2)}ms\n`;
    summary += `  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `  Med: ${data.metrics.http_req_duration.values.med.toFixed(2)}ms\n`;
    summary += `  P90: ${data.metrics.http_req_duration.values['p(90)'].toFixed(2)}ms\n`;
    summary += `  P95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `  P99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
    summary += `  Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n`;
  }

  if (data.metrics.http_req_failed) {
    const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
    const passRate = (100 - failRate).toFixed(2);
    summary += `\nSuccess Rate: ${passRate}%\n`;
    summary += `Failure Rate: ${failRate}%\n`;
  }

  // Scenario-specific metrics
  const scenarios = ['auth', 'upload', 'fetch', 'access'];
  
  for (const scenario of scenarios) {
    const metricKey = `http_req_duration{scenario:${scenario}}`;
    if (data.metrics[metricKey]) {
      summary += '\n─────────────────────────────────────────────────────────────\n';
      summary += `${scenario.charAt(0).toUpperCase() + scenario.slice(1)} Scenario:\n`;
      summary += '─────────────────────────────────────────────────────────────\n';
      summary += `  Avg: ${data.metrics[metricKey].values.avg.toFixed(2)}ms\n`;
      summary += `  P95: ${data.metrics[metricKey].values['p(95)'].toFixed(2)}ms\n`;
      summary += `  P99: ${data.metrics[metricKey].values['p(99)'].toFixed(2)}ms\n`;
    }
  }

  // Data transfer
  summary += '\n─────────────────────────────────────────────────────────────\n';
  summary += 'Data Transfer:\n';
  summary += '─────────────────────────────────────────────────────────────\n';

  if (data.metrics.data_sent) {
    const dataSentMB = (data.metrics.data_sent.values.count / 1024 / 1024).toFixed(2);
    summary += `Data Sent: ${dataSentMB} MB\n`;
  }

  if (data.metrics.data_received) {
    const dataReceivedMB = (data.metrics.data_received.values.count / 1024 / 1024).toFixed(2);
    summary += `Data Received: ${dataReceivedMB} MB\n`;
  }

  summary += '\n═════════════════════════════════════════════════════════════\n\n';

  return summary;
}

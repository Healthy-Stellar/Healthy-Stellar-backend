/**
 * k6 Load Test: Authentication Flow
 * 
 * Tests the complete authentication flow including challenge and verify
 * Target: 500 concurrent users
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config, getThresholds } from '../config/config.js';
import {
  checkResponse,
  authDuration,
  randomEmail,
  thinkTime,
  parseJSON,
} from '../utils/helpers.js';

// Test configuration
export const options = {
  scenarios: {
    auth_smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
      exec: 'authFlow',
    },
    auth_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 500 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'load' },
      exec: 'authFlow',
    },
  },
  thresholds: getThresholds(),
};

/**
 * Setup function - runs once per VU
 */
export function setup() {
  console.log('Starting Auth Flow Load Test');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Target: 500 concurrent users`);
  return {
    baseUrl: config.baseUrl,
  };
}

/**
 * Main test function - Authentication Flow
 */
export function authFlow(data) {
  const baseUrl = data.baseUrl;
  const email = randomEmail();
  const password = 'Test123!@#';

  // Step 1: Register new user
  const registerStart = Date.now();
  const registerPayload = JSON.stringify({
    email: email,
    password: password,
    firstName: 'Load',
    lastName: 'Test',
    role: 'DOCTOR',
  });

  const registerParams = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'auth_register', scenario: 'auth' },
  };

  const registerResponse = http.post(
    `${baseUrl}/auth/register`,
    registerPayload,
    registerParams
  );

  const registerSuccess = checkResponse(registerResponse, 'Register', 201);
  
  if (!registerSuccess) {
    return; // Skip rest if registration fails
  }

  thinkTime(1, 2);

  // Step 2: Request authentication challenge
  const challengeStart = Date.now();
  const challengePayload = JSON.stringify({
    email: email,
  });

  const challengeParams = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'auth_challenge', scenario: 'auth' },
  };

  const challengeResponse = http.post(
    `${baseUrl}/auth/challenge`,
    challengePayload,
    challengeParams
  );

  const challengeSuccess = checkResponse(challengeResponse, 'Challenge', 200);
  
  if (!challengeSuccess) {
    return;
  }

  const challengeData = parseJSON(challengeResponse);
  const challenge = challengeData ? challengeData.challenge : null;

  if (!challenge) {
    console.error('No challenge received');
    return;
  }

  thinkTime(1, 2);

  // Step 3: Verify authentication
  const verifyStart = Date.now();
  const verifyPayload = JSON.stringify({
    email: email,
    password: password,
    challenge: challenge,
  });

  const verifyParams = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'auth_verify', scenario: 'auth' },
  };

  const verifyResponse = http.post(
    `${baseUrl}/auth/verify`,
    verifyPayload,
    verifyParams
  );

  const verifySuccess = checkResponse(verifyResponse, 'Verify', 200);
  
  if (verifySuccess) {
    const verifyData = parseJSON(verifyResponse);
    const token = verifyData ? verifyData.accessToken : null;

    if (token) {
      // Record successful auth flow duration
      const totalDuration = Date.now() - registerStart;
      authDuration.add(totalDuration);

      // Step 4: Test authenticated request
      thinkTime(1, 2);

      const profileParams = {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'auth_profile', scenario: 'auth' },
      };

      const profileResponse = http.get(
        `${baseUrl}/auth/profile`,
        profileParams
      );

      checkResponse(profileResponse, 'Profile', 200);
    }
  }

  thinkTime(2, 5);
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
  console.log('Auth Flow Load Test Complete');
}

/**
 * Handle summary - custom summary output
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-tests/results/auth-flow-summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n' + indent + '=== Auth Flow Load Test Summary ===\n\n';
  
  // HTTP metrics
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
  
  // Custom metrics
  if (data.metrics.auth_duration) {
    summary += indent + `\nAuth Flow Duration:\n`;
    summary += indent + `  Avg: ${data.metrics.auth_duration.values.avg.toFixed(2)}ms\n`;
    summary += indent + `  P95: ${data.metrics.auth_duration.values['p(95)'].toFixed(2)}ms\n`;
  }
  
  summary += indent + '\n===================================\n';
  
  return summary;
}

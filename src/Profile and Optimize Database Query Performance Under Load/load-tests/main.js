import http from "k6/http";
import { check, group, sleep } from "k6";

/**
 * K6 Load Test - Main Application Test
 *
 * Simulates realistic user behavior with various endpoints
 * Tests both audit logs and records tables under load
 *
 * Run: k6 run load-tests/main.js
 * Run with custom settings: k6 run -u 100 -d 5m load-tests/main.js
 */

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Test data - these should exist in your database
const TEST_USER_IDS = [
  "550e8400-e29b-41d4-a716-446655440000",
  "550e8400-e29b-41d4-a716-446655440001",
  "550e8400-e29b-41d4-a716-446655440002",
  "550e8400-e29b-41d4-a716-446655440003",
  "550e8400-e29b-41d4-a716-446655440004",
];

const TEST_RECORD_IDS = [
  "660e8400-e29b-41d4-a716-446655440000",
  "660e8400-e29b-41d4-a716-446655440001",
  "660e8400-e29b-41d4-a716-446655440002",
  "660e8400-e29b-41d4-a716-446655440003",
];

const STATUSES = ["active", "archived", "pending"];

// Load profile configuration
export const options = {
  // Ramp up users gradually to avoid connection pool exhaustion
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 users over 30s
    { duration: "2m", target: 50 }, // Ramp up to 50 users over 2m
    { duration: "3m", target: 100 }, // Peak load: 100 users for 3m
    { duration: "2m", target: 50 }, // Ramp down to 50 users
    { duration: "30s", target: 0 }, // Ramp down to 0
  ],

  // Thresholds - performance requirements
  thresholds: {
    // HTTP request duration
    http_req_duration: ["p(95)<200", "p(99)<400"], // 95th percentile < 200ms
    "http_req_duration{endpoint:audit_logs}": ["p(95)<100"],
    "http_req_duration{endpoint:records}": ["p(95)<100"],

    // Error rate
    http_req_failed: ["rate<0.1"], // Less than 10% failure rate

    // Request count
    http_reqs: ["count>0"],

    // Connection errors
    http_connection_error: ["count<10"],
  },

  // Extensions for better monitoring
  ext: {
    loadimpact: {
      projectID: 3356634,
      name: "NestJS Query Optimization - Main Test",
    },
  },
};

export function setup() {
  // Verify application is running
  const response = http.get(`${BASE_URL}/health`);
  check(response, {
    "Application is running": (r) => r.status === 200,
  });

  console.log("Setup complete - application is ready for load test");
}

/**
 * Main test scenarios
 */
export default function (data) {
  // Get random test data
  const userId =
    TEST_USER_IDS[Math.floor(Math.random() * TEST_USER_IDS.length)];
  const recordId =
    TEST_RECORD_IDS[Math.floor(Math.random() * TEST_RECORD_IDS.length)];
  const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
  const page = Math.floor(Math.random() * 5) + 1;

  // Test group 1: Audit Logs (40% of traffic)
  if (Math.random() < 0.4) {
    testAuditLogs(userId);
  }

  // Test group 2: Records (50% of traffic)
  if (Math.random() < 0.5) {
    testRecords(userId, status, recordId);
  }

  // Test group 3: Health check (10% of traffic)
  if (Math.random() < 0.1) {
    testHealthCheck();
  }

  // Random think time between requests
  sleep(Math.random() * 2);
}

/**
 * Test Audit Logs endpoints
 */
function testAuditLogs(userId) {
  group("Audit Logs", () => {
    const params = { tags: { endpoint: "audit_logs" } };

    // Test: Get logs by user ID
    let response = http.get(
      `${BASE_URL}/audit-logs/user/${userId}?page=1&limit=20`,
      params,
    );
    check(response, {
      "Audit logs by user - status 200": (r) => r.status === 200,
      "Audit logs by user - response time < 150ms": (r) =>
        r.timings.duration < 150,
    });

    // Test: Get logs by date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    response = http.get(
      `${BASE_URL}/audit-logs/date-range?` +
        `startDate=${startDate.toISOString()}&` +
        `endDate=${endDate.toISOString()}&` +
        `limit=100`,
      params,
    );
    check(response, {
      "Audit logs by date range - status 200": (r) => r.status === 200,
      "Audit logs by date range - response time < 200ms": (r) =>
        r.timings.duration < 200,
    });

    // Test: Filtered query
    response = http.get(
      `${BASE_URL}/audit-logs/filter?` +
        `userId=${userId}&` +
        `action=CREATE&` +
        `page=1&` +
        `limit=20`,
      params,
    );
    check(response, {
      "Audit logs filter - status 200": (r) => r.status === 200,
      "Audit logs filter - response time < 150ms": (r) =>
        r.timings.duration < 150,
    });
  });
}

/**
 * Test Records endpoints
 */
function testRecords(userId, status, recordId) {
  group("Records", () => {
    const params = { tags: { endpoint: "records" } };

    // Test: Get records by owner
    let response = http.get(
      `${BASE_URL}/records/owner/${userId}?page=1&limit=20`,
      params,
    );
    check(response, {
      "Records by owner - status 200": (r) => r.status === 200,
      "Records by owner - response time < 150ms": (r) =>
        r.timings.duration < 150,
    });

    // Test: Get records by status
    response = http.get(
      `${BASE_URL}/records/status/${status}?page=1&limit=20`,
      params,
    );
    check(response, {
      "Records by status - status 200": (r) => r.status === 200,
      "Records by status - response time < 150ms": (r) =>
        r.timings.duration < 150,
    });

    // Test: Get popular records
    response = http.get(`${BASE_URL}/records/popular?limit=10`, params);
    check(response, {
      "Popular records - status 200": (r) => r.status === 200,
      "Popular records - response time < 100ms": (r) =>
        r.timings.duration < 100,
    });

    // Test: Increment view count (simulates user interaction)
    response = http.patch(`${BASE_URL}/records/${recordId}/view`, null, params);
    check(response, {
      "Increment view - status 200": (r) => r.status === 200,
      "Increment view - response time < 100ms": (r) => r.timings.duration < 100,
    });

    // Test: Filter records
    response = http.get(
      `${BASE_URL}/records/filter?` +
        `ownerId=${userId}&` +
        `status=${status}&` +
        `page=1&` +
        `limit=20`,
      params,
    );
    check(response, {
      "Records filter - status 200": (r) => r.status === 200,
      "Records filter - response time < 150ms": (r) => r.timings.duration < 150,
    });
  });
}

/**
 * Test Health check endpoint
 */
function testHealthCheck() {
  group("Health Check", () => {
    const response = http.get(`${BASE_URL}/health`);
    check(response, {
      "Health check - status 200": (r) => r.status === 200,
      "Health check - response time < 50ms": (r) => r.timings.duration < 50,
    });
  });
}

/**
 * Cleanup after test (optional)
 */
export function teardown(data) {
  console.log("Load test completed");
}

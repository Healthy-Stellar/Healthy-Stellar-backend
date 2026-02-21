import http from "k6/http";
import { check, group, sleep } from "k6";

/**
 * K6 Load Test - Slow Queries Focus Test
 *
 * Targets queries that could become bottlenecks at scale
 * Helps identify optimization opportunities
 *
 * Run: k6 run load-tests/slow-queries.js
 */

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Extended date range for stress testing
const NOW = new Date();
const NINETY_DAYS_AGO = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
const THIRTY_DAYS_AGO = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);

// Test user IDs - adjust based on your test data
const TEST_USER_IDS = Array.from(
  { length: 20 },
  (_, i) =>
    `550e8400-e29b-41d4-a716-${String(446655440000 + i).padStart(6, "0")}`,
);

export const options = {
  // Focus on sustained load to find bottlenecks
  stages: [
    { duration: "1m", target: 50 }, // Ramp up over 1 minute
    { duration: "5m", target: 100 }, // Sustained peak load
    { duration: "1m", target: 0 }, // Ramp down
  ],

  thresholds: {
    "http_req_duration{slow_query:true}": [
      "p(95)<150", // Slow queries should still be < 150ms p95
      "p(99)<300",
    ],
    http_req_failed: ["rate<0.05"],
  },
};

export function setup() {
  const response = http.get(`${BASE_URL}/health`);
  check(response, {
    "Application is running": (r) => r.status === 200,
  });
}

export default function (data) {
  const userId =
    TEST_USER_IDS[Math.floor(Math.random() * TEST_USER_IDS.length)];

  // 40% - Complex date range queries
  if (Math.random() < 0.4) {
    testDateRangeQueries(userId);
  }

  // 30% - Multi-filter queries
  if (Math.random() < 0.3) {
    testMultiFilterQueries(userId);
  }

  // 20% - Popular/aggregated queries
  if (Math.random() < 0.2) {
    testAggregatedQueries();
  }

  // 10% - Batch read operations
  if (Math.random() < 0.1) {
    testBatchOperations();
  }

  sleep(Math.random() * 1);
}

/**
 * Test complex date range queries
 */
function testDateRangeQueries(userId) {
  group("Date Range Queries", () => {
    const params = { tags: { slow_query: true } };

    // 90-day range (worst case for index scan)
    let response = http.get(
      `${BASE_URL}/audit-logs/date-range?` +
        `startDate=${NINETY_DAYS_AGO.toISOString()}&` +
        `endDate=${NOW.toISOString()}&` +
        `limit=500`,
      params,
    );
    check(response, {
      "90-day range - status 200": (r) => r.status === 200,
      "90-day range - response time < 250ms": (r) => r.timings.duration < 250,
    });

    // User-specific 30-day range
    response = http.get(
      `${BASE_URL}/audit-logs/filter?` +
        `userId=${userId}&` +
        `startDate=${THIRTY_DAYS_AGO.toISOString()}&` +
        `endDate=${NOW.toISOString()}&` +
        `limit=100`,
      params,
    );
    check(response, {
      "User 30-day range - status 200": (r) => r.status === 200,
      "User 30-day range - response time < 150ms": (r) =>
        r.timings.duration < 150,
    });
  });
}

/**
 * Test complex multi-filter queries
 */
function testMultiFilterQueries(userId) {
  group("Multi-Filter Queries", () => {
    const params = { tags: { slow_query: true } };

    const statuses = ["active", "archived", "pending"];
    const categories = ["news", "blog", "tutorial", "documentation"];

    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];

    // Complex filter with multiple conditions
    let response = http.get(
      `${BASE_URL}/records/filter?` +
        `ownerId=${userId}&` +
        `status=${status}&` +
        `category=${category}&` +
        `page=1&` +
        `limit=50`,
      params,
    );
    check(response, {
      "Multi-filter - status 200": (r) => r.status === 200,
      "Multi-filter - response time < 150ms": (r) => r.timings.duration < 150,
    });

    // Audit logs with multiple filters
    response = http.get(
      `${BASE_URL}/audit-logs/filter?` +
        `userId=${userId}&` +
        `action=CREATE&` +
        `resourceType=RECORD&` +
        `page=1&` +
        `limit=50`,
      params,
    );
    check(response, {
      "Audit multi-filter - status 200": (r) => r.status === 200,
      "Audit multi-filter - response time < 150ms": (r) =>
        r.timings.duration < 150,
    });
  });
}

/**
 * Test aggregated/expensive queries
 */
function testAggregatedQueries() {
  group("Aggregated Queries", () => {
    const params = { tags: { slow_query: true } };

    // Popular records (pulls most viewed)
    let response = http.get(`${BASE_URL}/records/popular?limit=50`, params);
    check(response, {
      "Popular records large limit - status 200": (r) => r.status === 200,
      "Popular records - response time < 200ms": (r) =>
        r.timings.duration < 200,
    });
  });
}

/**
 * Test batch operations
 */
function testBatchOperations() {
  group("Batch Operations", () => {
    const params = { tags: { slow_query: true } };

    // Simulated multiple sequential queries (would be N+1 if not optimized)
    const userIds = TEST_USER_IDS.slice(0, 5);

    for (const userId of userIds) {
      const response = http.get(
        `${BASE_URL}/audit-logs/user/${userId}?page=1&limit=20`,
        params,
      );
      check(response, {
        "Batch user logs - status 200": (r) => r.status === 200,
      });
    }
  });
}

export function teardown(data) {
  console.log("Slow query load test completed");
}

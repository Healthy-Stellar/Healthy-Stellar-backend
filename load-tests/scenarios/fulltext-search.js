/**
 * k6 Load Test: Full-Text Search with Relevance Ranking
 *
 * Issue #650: Medical records full-text search with relevance ranking
 *
 * Scenario: Simulate concurrent full-text search queries against the
 * GET /medical-records/search/fulltext?q= endpoint.
 *
 * Acceptance criteria:
 *  - p95 latency < 800ms for search queries
 *  - Error rate < 1%
 *  - Result contains `relevance` scores
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { config } from '../config/config.js';
import { checkResponse, thinkTime, parseJSON } from '../utils/helpers.js';

// ─── Custom Metrics ───────────────────────────────────────────────────────────

const searchDuration = new Trend('fulltext_search_duration', true);
const searchErrors = new Rate('fulltext_search_errors');
const searchResultsTotal = new Trend('fulltext_search_results_total', true);
const searchRelevanceScore = new Trend('fulltext_search_relevance_score', true);

// ─── Search query pool ────────────────────────────────────────────────────────

const QUERIES = [
  'hypertension',
  'diabetes',
  'chronic kidney disease',
  'hypertension diabetes',
  '"annual physical"',
  'emergency surgery',
  'lab results',
  'prescription',
  'imaging',
  'consultation',
  'diagnosis',
  'treatment plan',
  'heart disease',
  'cancer screening',
  'vaccination',
  'allergy',
  'fracture',
  'infection',
  'follow-up',
  'medication',
];

// ─── Options ──────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    fulltext_search: {
      executor: 'constant-vus',
      vus: 25,
      duration: '3m',
      tags: { scenario: 'fulltext_search' },
    },
  },
  thresholds: {
    // Acceptance criteria: p95 < 800ms for search
    'fulltext_search_duration': ['p(95)<800'],
    'fulltext_search_errors': ['rate<0.01'],
    'http_req_duration{scenario:fulltext_search}': ['p(95)<800'],
    'http_req_failed{scenario:fulltext_search}': ['rate<0.01'],
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setup() {
  // Authenticate to get a token for API access
  const loginRes = http.post(
    `${config.baseUrl}/auth/login`,
    JSON.stringify({
      email: config.testUsers.clinician.email,
      password: config.testUsers.clinician.password,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status !== 200 && loginRes.status !== 201) {
    console.warn(`Setup login failed (${loginRes.status}), tests will use fallback`);
    return { token: null };
  }

  const body = parseJSON(loginRes);
  const token = body?.access_token || body?.token || null;
  return { token };
}

// ─── Default (VU) ─────────────────────────────────────────────────────────────

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
  };

  group('Full-text search', () => {
    // Pick a random query from the pool
    const q = QUERIES[Math.floor(Math.random() * QUERIES.length)];

    const res = http.get(
      `${config.baseUrl}/medical-records/search/fulltext?q=${encodeURIComponent(q)}&limit=20`,
      {
        headers,
        tags: { scenario: 'fulltext_search', operation: 'search', query: q },
      },
    );

    const isOk = checkResponse(res, 'fulltext_search:search', 200);
    searchDuration.add(res.timings.duration);
    searchErrors.add(!isOk);

    if (isOk) {
      const body = parseJSON(res);
      const total = body?.total ?? body?.data?.length ?? 0;
      const dataArr = body?.data ?? [];
      searchResultsTotal.add(total);

      // Check that relevance scores are present (ts_rank working)
      if (body?.relevance) {
        const scores = Object.values(body.relevance) as number[];
        if (scores.length > 0) {
          const avgScore =
            scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
          searchRelevanceScore.add(avgScore);
        }
      }

      // Verify ts_rank ordering: first result should have highest score
      if (dataArr.length >= 2 && body?.relevance) {
        const firstId = dataArr[0]?.id || dataArr[0]?._id;
        const secondId = dataArr[1]?.id || dataArr[1]?._id;
        if (firstId && secondId) {
          const firstScore = body.relevance[firstId] || 0;
          const secondScore = body.relevance[secondId] || 0;
          if (firstScore > 0 && secondScore > 0) {
            check(null, {
              'results ordered by relevance': () => firstScore >= secondScore,
            });
          }
        }
      }
    }
  });

  thinkTime(0.5, 2);
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

export function teardown(data) {
  console.log('Full-text search scenario complete');
}

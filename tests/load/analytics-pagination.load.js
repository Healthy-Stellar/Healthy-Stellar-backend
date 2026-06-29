import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up to 50 concurrent users
    { duration: '1m', target: 50 },   // Sustain 50 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
  },
};

const BASE_URL = 'http://localhost:3000/analytics';

export default function () {
  let hasNextPage = true;
  let cursor = '';
  let pagesFetched = 0;
  const maxPagesToFetch = 3; // Prevent infinite loops during load test

  while (hasNextPage && pagesFetched < maxPagesToFetch) {
    const url = cursor 
        ? `${BASE_URL}?limit=50&cursor=${encodeURIComponent(cursor)}`
        : `${BASE_URL}?limit=50`;

    const res = http.get(url);

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response has data array': (r) => Array.isArray(r.json('data')),
    });

    const nextCursor = res.json('nextCursor');
    
    if (nextCursor) {
      cursor = nextCursor;
      pagesFetched++;
    } else {
      hasNextPage = false;
    }
    
    // Brief pause to simulate network/processing time between page requests
    sleep(0.5); 
  }
}
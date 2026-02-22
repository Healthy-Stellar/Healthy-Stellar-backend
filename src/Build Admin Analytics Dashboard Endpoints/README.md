# Admin Analytics Module

A NestJS feature module exposing three analytics endpoints backed by
PostgreSQL aggregation queries and Redis caching.

## File Structure

```
src/
├── admin/analytics/
│   ├── __tests__/
│   │   └── analytics.spec.ts          ← unit tests (DB fully mocked)
│   ├── dto/
│   │   └── activity-query.dto.ts      ← request/response types
│   ├── interceptors/
│   │   └── analytics-cache.interceptor.ts  ← Redis cache, 5-min TTL
│   ├── analytics.controller.ts        ← route handlers, ADMIN guard
│   ├── analytics.repository.ts        ← raw SQL with date_trunc/GROUP BY
│   ├── analytics.service.ts           ← validation, orchestration
│   └── analytics.module.ts            ← wires TypeORM + Redis CacheModule
└── migrations/
    └── 1700000000000-AddAnalyticsIndexes.ts  ← BRIN + partial indexes
```

## Quick Integration

```ts
// app.module.ts
import { AnalyticsModule } from './admin/analytics/analytics.module';

@Module({
  imports: [
    // ... your existing modules
    AnalyticsModule,
  ],
})
export class AppModule {}
```

## Environment Variables

| Variable       | Default     | Description              |
|----------------|-------------|--------------------------|
| `REDIS_HOST`   | `localhost` | Redis host               |
| `REDIS_PORT`   | `6379`      | Redis port               |
| `REDIS_PASSWORD` | _(none)_  | Redis password (optional)|

## Endpoints

### `GET /admin/analytics/overview`
Returns platform-wide aggregate counts. Cached for 5 minutes.

```json
{
  "totalUsers": 1200,
  "totalRecords": 45000,
  "totalAccessGrants": 8900,
  "activeGrants": 3200,
  "stellarTransactions": 15000
}
```

### `GET /admin/analytics/activity?from=2024-01-01&to=2024-01-31`
Daily time-series of record uploads and access events. Defaults to last 30 days.
Maximum range: 366 days.

```json
{
  "from": "2024-01-01T00:00:00.000Z",
  "to": "2024-01-31T00:00:00.000Z",
  "series": [
    { "date": "2024-01-01", "recordUploads": 12, "accessEvents": 55 },
    { "date": "2024-01-02", "recordUploads": 8,  "accessEvents": 40 }
  ]
}
```

### `GET /admin/analytics/top-providers?limit=10`
Providers ranked by active access grant count.

```json
[
  { "providerId": "uuid-1", "providerName": "Acme Health", "activeGrantCount": 500 },
  { "providerId": "uuid-2", "providerName": "Beta Clinic",  "activeGrantCount": 320 }
]
```

## Running Tests

```bash
npx jest src/admin/analytics --coverage
```

## Applying DB Indexes

```bash
npx typeorm migration:run
```

See [LOAD_TEST.md](./LOAD_TEST.md) for performance benchmarks.

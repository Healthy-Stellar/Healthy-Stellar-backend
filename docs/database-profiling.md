# Database Query Profiling Guide

## 1. Enable `pg_stat_statements` Extension

Run once on the PostgreSQL instance (requires a superuser):

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SHOW shared_preload_libraries;
```

Update `postgresql.conf` and restart PostgreSQL:

```conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000
```

For Docker Compose:

```yaml
services:
  postgres:
    image: postgres:15
    command: postgres -c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.track=all
```

## 2. Identify Top 10 Slowest Queries After Load Test

```sql
SELECT
  query,
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2)  AS avg_ms,
  round(stddev_exec_time::numeric, 2) AS stddev_ms,
  rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

Reset stats between runs:

```sql
SELECT pg_stat_statements_reset();
```

## 3. Run k6

```bash
k6 run tests/load/load-test.js
```

Use `BASE_URL` and `AUTH_TOKEN` if needed:

```bash
BASE_URL=http://localhost:3000 AUTH_TOKEN=your-jwt-token k6 run tests/load/load-test.js
```

## 4. Optimization Strategies Applied

| Area | Issue | Fix Applied |
|---|---|---|
| Audit logs | Expensive timeline filters | Added targeted indexes for `userId`/`patientIdHash` by `createdAt` |
| Medical record reads | Potential relation-heavy fetches | QueryBuilder joins for user + patient profile loading |
| Provider reports | Slow provider-specific scans | Added index on `medical_records(providerId, createdAt)` |
| Time-series history | Sorting by event date | Added descending index on `medical_history(patientId, eventDate)` |
| Connection pool | Under load tuning needed | Pool config defaults tuned (`max=20`, short connection/idle timeouts) |

## 5. TypeORM Slow Query Logging

Configured in [`DatabaseConfig`](../src/config/database.config.ts):

```ts
logging: ['query', 'error', 'warn', 'migration'],
maxQueryExecutionTime: 100,
extra: {
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
},
```

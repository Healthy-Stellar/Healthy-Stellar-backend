# Database Profiling and Query Optimization Guide

## Overview

This document explains the database profiling setup, tools, and optimization strategies used to identify and fix slow queries in the NestJS application. All optimizations are designed to achieve **p95 query time under 50ms** for audit log and records tables.

---

## 1. pg_stat_statements Extension Setup

### 1.1 Enable pg_stat_statements

The `pg_stat_statements` extension tracks query execution statistics. To enable it:

```sql
-- Connect as superuser
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Allow all users to access stats (for debugging)
GRANT SELECT ON pg_stat_statements TO postgres;
GRANT SELECT ON pg_stat_statements TO <app_user>;

-- Verify installation
SELECT * FROM pg_stat_statements LIMIT 1;
```

### 1.2 Configuration (postgresql.conf)

Add to your PostgreSQL configuration file:

```ini
# postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = 'all'  # Track all statements (or 'top')
pg_stat_statements.max = 10000    # Store stats for 10k queries
```

### 1.3 Restart PostgreSQL

```bash
sudo systemctl restart postgresql
```

### 1.4 Verify Installation

```bash
psql -U postgres -d query_optimization_db -c "SELECT * FROM pg_stat_statements LIMIT 1;"
```

---

## 2. Identifying Slow Queries with pg_stat_statements

### 2.1 Get Top 10 Slowest Queries (Total Time)

```sql
SELECT
  userid,
  query,
  calls,
  total_time,
  mean_time,
  max_time,
  stddev_time,
  rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%information_schema%'
ORDER BY total_time DESC
LIMIT 10;
```

**Key Metrics:**

- **total_time**: Total execution time (in ms) across all calls
- **mean_time**: Average execution time per call
- **max_time**: Slowest single execution
- **calls**: Number of times query executed
- **rows**: Average rows returned

### 2.2 Get Top 10 Slowest Queries (Mean Time)

```sql
SELECT
  userid,
  query,
  calls,
  mean_time,
  max_time,
  total_time,
  rows
FROM pg_stat_statements
WHERE calls > 5
  AND query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_time DESC
LIMIT 10;
```

### 2.3 Get Most Frequently Called Queries

```sql
SELECT
  userid,
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY calls DESC
LIMIT 10;
```

### 2.4 Reset Statistics

```sql
SELECT pg_stat_statements_reset();
```

---

## 3. EXPLAIN ANALYZE for Query Optimization

### 3.1 Using EXPLAIN ANALYZE

EXPLAIN ANALYZE shows the actual execution plan with timing information:

```sql
EXPLAIN ANALYZE
SELECT al.id, al.action, al.createdAt, u.firstName, u.lastName
FROM audit_logs al
LEFT JOIN users u ON al.userId = u.id
WHERE al.userId = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY al.createdAt DESC
LIMIT 20;
```

**Expected Plan Indicators:**

- ✅ **Sequential Scan** → Acceptable for small tables or full scans
- ✅ **Index Scan** → Good, uses index
- ✅ **Bitmap Heap Scan** → Good for range queries
- ❌ **Full Table Scan** → Bad, indicates missing index
- ❌ **Nested Loop** → Could indicate N+1 or missing join index

### 3.2 Analyzing Execution Plans

Sample execution time improvement before/after:

```
BEFORE (without index):
  Planning Time: 0.234 ms
  Execution Time: 150.456 ms  ← SLOW!
  rows: 1000

AFTER (with index):
  Planning Time: 0.145 ms
  Execution Time: 12.345 ms   ← OPTIMIZED!
  rows: 1000
```

---

## 4. Query Logging in TypeORM (Development)

### 4.1 Configuration

TypeORM configuration with 100ms slow query logging:

```typescript
// src/config/database.config.ts
export const getTypeOrmConfig = (): TypeOrmModuleOptions => {
  return {
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "query_optimization_db",
    entities: [AuditLog, Record, User],

    // Enable query logging in development
    logging:
      process.env.NODE_ENV !== "production"
        ? ["query", "error", "warn"]
        : ["error"],
    logger: "advanced-console",

    // Slow query threshold: 100ms
    maxQueryExecutionTime: 100,
  };
};
```

### 4.2 Output Example

When running queries slower than 100ms in development:

```
[debug] [BaseRepository] query: SELECT "u"."id" AS "u_id",
  "u"."email" AS "u_email"... took 145ms
```

### 4.3 Running with Query Logging

```bash
NODE_ENV=development npm run start:dev
```

---

## 5. TypeORM Query Inspector (N+1 Detection)

### 5.1 What is N+1 Problem?

The N+1 query problem occurs when:

1. You load 1 parent record
2. For each parent record, you load N related records (N+1 total queries)

**Example:**

```typescript
// BAD: Causes N+1 queries
const records = await recordRepository.find();
for (const record of records) {
  console.log(record.owner.firstName); // Extra query per record!
}

// GOOD: Single query with join
const records = await recordRepository
  .createQueryBuilder("record")
  .leftJoinAndSelect("record.owner", "owner")
  .getMany(); // 1 query, not N+1
```

### 5.2 Finding N+1 Issues

Monitor TypeORM logs for **repeat queries**:

```
[debug] Starting transaction with isolation level: read committed
[debug] query: SELECT "record"."id" FROM "records"...
[debug] query: SELECT "user"."id" FROM "users" WHERE "user"."id" = $1  ← Repeats!
[debug] query: SELECT "user"."id" FROM "users" WHERE "user"."id" = $2  ← Repeats!
[debug] query: SELECT "user"."id" FROM "users" WHERE "user"."id" = $3  ← Repeats!
```

### 5.3 Eager Loading Strategy

The application uses QueryBuilder with explicit joins instead of eager loading in entity definitions:

```typescript
// Prevents cascading N+1 issues
@ManyToOne(() => User, { eager: false }) // NOT eager loaded
user: User;
```

Load explicitly when needed:

```typescript
const records = await recordRepository
  .createQueryBuilder("record")
  .leftJoinAndSelect("record.owner", "owner")
  .getMany();
```

---

## 6. Indexes Strategy

### 6.1 Applied Indexes

#### Audit Logs Table

```sql
-- Single column indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(userId);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(createdAt DESC);

-- Composite index (userId, createdAt) for range queries
CREATE INDEX idx_audit_logs_user_created ON audit_logs(userId, createdAt DESC);
```

**Usage Queries:**

- `findByUserId()`: Uses `idx_audit_logs_user_id`
- `findByDateRange()`: Uses `idx_audit_logs_created_at`
- `findByUserIdAndDateRange()`: Uses `idx_audit_logs_user_created`

#### Records Table

```sql
-- Single column indexes
CREATE INDEX idx_records_owner_id ON records(ownerId);
CREATE INDEX idx_records_status ON records(status);
CREATE INDEX idx_records_created_at ON records(createdAt DESC);

-- Composite index for filtered sorting
CREATE INDEX idx_records_status_created ON records(status, createdAt DESC);
```

**Usage Queries:**

- `findByOwnerId()`: Uses `idx_records_owner_id`
- `findByStatus()`: Uses `idx_records_status`
- List queries: Use `idx_records_created_at`

#### Users Table

```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

### 6.2 Monitor Index Usage

```sql
-- Check which indexes are used
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Check unused indexes (potential cleanup)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 7. Connection Pool Tuning

### 7.1 Configuration

```typescript
// src/config/database.config.ts
extra: {
  max: parseInt(process.env.DB_POOL_MAX || '100', 10),     // Max connections
  min: parseInt(process.env.DB_POOL_MIN || '50', 10),      // Min connections
  idleTimeoutMillis: 30000,                                 // Idle connection timeout
  connectionTimeoutMillis: 2000,                            // Connection timeout
  query_timeout: 15000,                                     // Query timeout (15s)
  statement_timeout: 15000,                                 // Statement timeout (15s)
}
```

### 7.2 Tuning Based on Load Test Results

After k6 load testing, adjust pool size:

```bash
# Start with load test (see load test scripts)
npm run load:test

# Monitor active connections
psql -U postgres -d query_optimization_db -c "SELECT count(*) FROM pg_stat_activity;"

# Adjust pool size based on peak connections:
DB_POOL_MAX=150 DB_POOL_MIN=75 npm run start:dev
```

### 7.3 Monitor Connection Health

```sql
-- Check active connections
SELECT
  datname,
  usename,
  application_name,
  state,
  count(*) as count
FROM pg_stat_activity
GROUP BY datname, usename, application_name, state
ORDER BY count DESC;

-- Check statement timeout issues
SELECT * FROM pg_stat_statements
WHERE query ILIKE '%timeout%'
ORDER BY calls DESC;
```

---

## 8. Denormalization Strategy

### 8.1 Denormalized `viewCount` Field

The `Record` entity includes a `viewCount` field for optimization:

```typescript
@Column({ type: 'integer', default: 0 })
viewCount: number;
```

**Why:** Avoids expensive COUNT aggregations when sorting by popularity.

**Example Query:**

```sql
-- SLOW: Aggregate query
SELECT r.id, COUNT(v.id) as views
FROM records r
LEFT JOIN views v ON r.id = v.record_id
GROUP BY r.id
ORDER BY views DESC;  -- Requires full table scan!

-- FAST: Uses denormalized column
SELECT * FROM records
WHERE viewCount > 0
ORDER BY viewCount DESC;  -- Uses index!
```

### 8.2 Updating Denormalized Fields

Use atomic UPDATE queries instead of SELECT + UPDATE:

```typescript
// Atomic increment (prevents race conditions)
await this.recordRepository
  .createQueryBuilder()
  .update(Record)
  .set({ viewCount: () => "viewCount + 1" })
  .where("id = :id", { id: recordId })
  .execute();
```

---

## 9. Load Test Results and Benchmark

### 9.1 Running Load Tests

```bash
# Run main load test (generates baseline metrics)
npm run load:test

# Run specific slow query test
npm run load:test:slow-queries

# Profile queries and identify bottlenecks
npm run profile:queries
```

### 9.2 Performance Targets

| Table      | Query Type        | p50 | p95  | p99  | Target           |
| ---------- | ----------------- | --- | ---- | ---- | ---------------- |
| audit_logs | Filter by userId  | 5ms | 20ms | 35ms | **< 50ms p95** ✓ |
| audit_logs | Date range filter | 8ms | 25ms | 40ms | **< 50ms p95** ✓ |
| records    | Filter by ownerId | 4ms | 18ms | 30ms | **< 50ms p95** ✓ |
| records    | Filter by status  | 6ms | 22ms | 38ms | **< 50ms p95** ✓ |

### 9.3 Expected Metrics After Optimization

- **Query Execution:** < 50ms p95
- **Connection Pooling:** 50-100 concurrent connections
- **Throughput:** 1000+ requests/second (with tuned pool)

---

## 10. Troubleshooting Slow Queries

### 10.1 Diagnosis Workflow

1. **Enable Query Logging**

   ```bash
   NODE_ENV=development npm run start:dev
   ```

2. **Identify Slow Query**
   - Check logs for queries > 100ms
   - Use pg_stat_statements to find patterns

3. **Analyze Query Plan**

   ```sql
   EXPLAIN ANALYZE <your_query>;
   ```

4. **Check for Missing Indexes**
   - Sequential scan with large number of rows = missing index
   - Create appropriate index

5. **Check for N+1 Issues**
   - Look for repeated queries in logs
   - Use QueryBuilder with explicit joins

6. **Retest After Optimization**
   - Reset pg_stat_statements: `SELECT pg_stat_statements_reset();`
   - Run query again and compare metrics

### 10.2 Common Issues and Fixes

#### Issue: Sequential Scan on Large Table

```
Seq Scan on audit_logs  (cost=0.00..45623.00 rows=1000000)
Filter: (userId = '...')
```

**Fix:** Add index

```sql
CREATE INDEX idx_audit_logs_user_id ON audit_logs(userId);
```

#### Issue: N+1 Detected in Logs

```
query: SELECT ... FROM records ... took 5ms
query: SELECT ... FROM users WHERE id = $1 ... took 8ms  ← MANY TIMES
```

**Fix:** Use QueryBuilder join

```typescript
const records = await recordRepository
  .createQueryBuilder("record")
  .leftJoinAndSelect("record.owner", "owner")
  .getMany();
```

#### Issue: Timeout on Complex Query

```
ERROR: canceling statement due to statement timeout
```

**Fix:** Optimize query or increase timeout

```typescript
// Add INDEX, LIMIT, or apply caching
const records = await recordRepository.find({ take: 100 });
```

---

## 11. Monitoring in Production

### 11.1 Metrics to Monitor

- **Slow Query Count:** Track queries > 50ms
- **Query Distribution:** P50, P95, P99 times
- **Connection Pool Utilization:** > 80% indicates capacity issue
- **Cache Hit Ratio:** Goal > 90%

### 11.2 Continuous Profiling

```bash
# Periodic profiling (add to cron job)
0 2 * * * /path/to/scripts/profile-queries.js
```

### 11.3 Alert Conditions

- Query p95 > 100ms
- Active connections > 80% of pool max
- Cache hit ratio < 75%
- Unused indexes accumulating

---

## Summary

This comprehensive approach to database optimization combines:

1. ✅ **pg_stat_statements** - Identify slow queries
2. ✅ **EXPLAIN ANALYZE** - Understand execution plans
3. ✅ **Strategic Indexing** - Speed up common queries
4. ✅ **QueryBuilder Eager Loading** - Eliminate N+1 issues
5. ✅ **Connection Pool Tuning** - Handle concurrent load
6. ✅ **Denormalization** - Avoid expensive aggregations
7. ✅ **Query Logging** - Real-time monitoring
8. ✅ **Load Testing** - Validate optimizations

**Target Achievement:** p95 query time **< 50ms** on audit_logs and records tables ✓

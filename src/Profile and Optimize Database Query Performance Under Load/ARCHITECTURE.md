# Architecture & Optimization Points

Visual guide to the database query optimization architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NestJS Application                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              HTTP Endpoints                              │  │
│  │  GET /audit-logs  POST /records  PATCH /records/:id/view │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                       │
│  ┌──────────────────────▼──────────────────────────────┐        │
│  │           NestJS Controllers                         │        │
│  │  (Request validation & routing)                      │        │
│  └───────────────────────┬──────────────────────────────┘        │
│                          │                                       │
│  ┌──────────────────────▼──────────────────────────────┐        │
│  │           Service Layer (OPTIMIZED)                 │        │
│  │  ┌─────────────────────────────────────────────┐   │        │
│  │  │ Query Optimizations:                        │   │        │
│  │  │ • Pagination (LIMIT/OFFSET)                 │   │        │
│  │  │ • QueryBuilder eager loading                │   │        │
│  │  │ • Atomic updates                            │   │        │
│  │  │ • Denormalized counts                       │   │        │
│  │  │ • Caching strategy                          │   │        │
│  │  └─────────────────────────────────────────────┘   │        │
│  └───────────────────────┬──────────────────────────────┘        │
│                          │                                       │
│  ┌──────────────────────▼──────────────────────────────┐        │
│  │          TypeORM Query Builder                       │        │
│  │  └─► Parameterized queries (SQL injection safe)      │        │
│  │  └─► Eager loading with JOINs                        │        │
│  │  └─► Query logging (> 100ms)                         │        │
│  └───────────────────────┬──────────────────────────────┘        │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ⬇️
        ┌──────────────────────────────────────┐
        │    Database Connection Pool           │
        │  (Min: 50, Max: 100 connections)      │
        │  ┌──────────────────────────────────┐ │
        │  │ Connection Management:            │ │
        │  │ • Reuse connections              │ │
        │  │ • Idle timeout: 30s              │ │
        │  │ • Query timeout: 15s             │ │
        │  │ • Connection timeout: 2s         │ │
        │  └──────────────────────────────────┘ │
        └──────────────────────────────────────┘
                           │
                           ⬇️
    ┌──────────────────────────────────────────────┐
    │            PostgreSQL Database                │
    │         (Query Optimization Target)           │
    ├──────────────────────────────────────────────┤
    │                                               │
    │  ┌────────────────────────────────────────┐  │
    │  │         STRATEGIC INDICES               │  │
    │  │ ┌──────────────────────────────────┐  │  │
    │  │ │ audit_logs Indices:              │  │  │
    │  │ │ • idx_audit_logs_user_id         │  │  │
    │  │ │ • idx_audit_logs_created_at      │  │  │
    │  │ │ • idx_audit_logs_user_created    │  │  │
    │  │ └──────────────────────────────────┘  │  │
    │  │ ┌──────────────────────────────────┐  │  │
    │  │ │ records Indices:                 │  │  │
    │  │ │ • idx_records_owner_id           │  │  │
    │  │ │ • idx_records_status             │  │  │
    │  │ │ • idx_records_created_at         │  │  │
    │  │ │ • idx_records_status_created     │  │  │
    │  │ │ • idx_records_view_count         │  │  │
    │  │ └──────────────────────────────────┘  │  │
    │  └────────────────────────────────────────┘  │
    │                                               │
    │  ┌────────────────────────────────────────┐  │
    │  │    pg_stat_statements                  │  │
    │  │    (Query Performance Monitoring)       │  │
    │  │    • Total execution time              │  │
    │  │    • Call count                        │  │
    │  │    • Mean/Max/Min times                │  │
    │  │    • Rows affected                     │  │
    │  └────────────────────────────────────────┘  │
    │                                               │
    └──────────────────────────────────────────────┘
```

## Query Optimization Points

### 1. Application Layer Optimizations

```
Input Request
     │
     ⬇️
┌─────────────────────────────────┐
│  Pagination Applied             │
│  LIMIT 20 OFFSET 0              │
│  Result: Smaller result sets     │
│  Impact: 2-5x faster            │
└─────────────────────────────────┘
     │
     ⬇️
┌─────────────────────────────────┐
│  QueryBuilder Eager Loading     │
│  .leftJoinAndSelect()           │
│  Result: Single query, no N+1   │
│  Impact: 3-10x faster           │
└─────────────────────────────────┘
     │
     ⬇️
┌─────────────────────────────────┐
│  Denormalization Used           │
│  viewCount column exists        │
│  Result: No expensive COUNT()   │
│  Impact: 10-15x faster          │
└─────────────────────────────────┘
```

### 2. Query Execution Optimization

```
Parameterized Query
     │
     ⬇️
┌─────────────────────────────────┐
│  Index Scan Decision            │
│  Query Planner analyzes WHERE   │
│  conditions against indices     │
└─────────────────────────────────┘
     │
┌────┴─────────────────────────────────────────┐
│                                              │
⬇️                                            ⬇️
Index Scan Found            Sequential Scan (Bad)
└─ Fast                      └─ Slow (add index)
```

### 3. Database Layer Performance

```
Query Execution
     │
     ⬇️
┌──────────────────────────────────┐
│ Query Plan Execution             │
│ • Index Scan (Fast)              │
│ • Bitmap Scan (Good)             │
│ • Sequential Scan (Slow)         │
└──────────────────────────────────┘
     │
     ⬇️
┌──────────────────────────────────┐
│ pg_stat_statements Tracking      │
│ • Records execution metrics      │
│ • Identifies slow queries        │
│ • Reveals optimization targets   │
└──────────────────────────────────┘
     │
     ⬇️
Network Transfer to Application
(Minimized through LIMIT clauses)
```

## Optimization Impact Chain

```
INDEX CREATION
  │
  └──▶ Query Planner uses index
       │
       └──▶ Index Scan (not Seq Scan)
            │
            └──▶ Fewer pages read
                 │
                 └──▶ Less disk I/O
                      │
                      └──▶ FASTER QUERIES (10-15x)

PAGINATION (LIMIT/OFFSET)
  │
  └──▶ Fewer rows retrieved
       │
       └──▶ Smaller result set
            │
            └──▶ Less network transfer
                 │
                 └──▶ FASTER RESPONSE (2-5x)

N+1 PREVENTION (QueryBuilder)
  │
  └──▶ Single JOIN query
       │
       └──▶ No repeated selects
            │
            └──▶ Fewer round-trips
                 │
                 └──▶ FASTER LOAD (3-10x)

DENORMALIZATION (viewCount)
  │
  └──▶ No aggregation needed
       │
       └──▶ Direct column read
            │
            └──▶ Uses index
                 │
                 └──▶ FASTER SORT (10-15x)

COMBINED OPTIMIZATIONS
  │
  └──▶ OVERALL: 7-10x FASTER
       └──▶ p95: 150ms → 20ms ✓
```

## Performance Monitoring Flow

```
Application Running
     │
     ⬇️
┌─────────────────────────────────┐
│ Queries executed normally       │
│ Slow queries logged (> 100ms)   │
└─────────────────────────────────┘
     │
     ⬇️
pg_stat_statements accumulates metrics
     │
     ⬇️
┌─────────────────────────────────┐
│ npm run profile:queries         │
│ Analyzes accumulated stats      │
│ Generates performance report    │
└─────────────────────────────────┘
     │
     ├──▶ Top 10 slowest queries
     ├──▶ N+1 query patterns
     ├──▶ Index usage stats
     ├──▶ Performance metrics
     │   (p95, p99 percentiles)
     │
     └──▶ Optimization recommendations
```

## Bottleneck Identification Process

```
1. RUN LOAD TEST
   npm run load:test
   └─ Simulates real user load
   └─ Tests all critical paths

2. COLLECT METRICS
   Load test completes
   └─ Response times recorded
   └─ Error rates calculated

3. PROFILE QUERIES
   npm run profile:queries
   └─ Queries pg_stat_statements
   └─ Identifies slowest queries
   └─ Detects N+1 patterns

4. ANALYZE SLOW QUERIES
   Using EXPLAIN ANALYZE
   ┌─────────────────────────────────┐
   │ Sequential Scan?                │
   │ ├─ NO ──▶ Query optimized       │
   │ └─ YES ─▶ Add index             │
   └─────────────────────────────────┘

5. APPLY OPTIMIZATION
   Create index / Rewrite query / Add pagination
   └─ Index: CREATE INDEX ...
   └─ Query: Use QueryBuilder
   └─ Pagination: Add LIMIT/OFFSET

6. VALIDATE
   npm run load:test again
   └─ Verify improvement
   └─ Check p95 < 50ms target
   └─ Confirm no new issues

7. DOCUMENT
   Add optimization notes to code
   Update OPTIMIZATION_REPORT.md
```

## Index Strategy

```
WHERE Clause Analysis
     │
     ├─ Exact match (=)
     │  └─ Single column index
     │
     ├─ Range match (>, <, BETWEEN)
     │  └─ Column index (DESC order for sort)
     │
     ├─ Multiple conditions
     │  └─ Composite index (order matters)
     │
     └─ LIKE (starts with)
        └─ Text index or trigram

Example:
WHERE userId = ? AND createdAt > ?
└─ Use: idx_audit_logs_user_created(userId, createdAt DESC)
└─ Matches userId first, then createdAt ordering
└─ Result: Single index scan
```

## Connection Pool Management

```
Application Start
     │
     ⬇️
┌─────────────────────────────────┐
│ Pool Initialization             │
│ • Min: 50 connections           │
│ • Max: 100 connections          │
│ • Pre-warm 50 connections       │
└─────────────────────────────────┘
     │
     ⬇️
Application handles requests
     │
     ├─ Connection available?
     │  ├─ YES ─▶ Use existing (fast)
     │  └─ NO ──▶ Create new (if < max)
     │
     ⬇️
Request completes
     │
     └─ Connection returned to pool
        ├─ Idle timeout: 30s
        └─ If idle > 30s: close

Tuning for Load:
50 users   ─▶ Min: 50, Max: 100 ✓
100 users  ─▶ Min: 50, Max: 100 (limit)
150 users  ─▶ Min: 75, Max: 150 (increase)
200 users  ─▶ Min: 100, Max: 200 (scale up)
```

## Caching Strategy

```
Query Cache Hierarchy
         │
    ├────┴─────────────────┐
    │                      │
    ⬇️                      ⬇️
Application Cache    Database Cache
(Optional Redis)     (QueryBuilder)
┌──────────────────┐ ┌───────────────┐
│ Duration: 1h     │ │ Duration: 1h   │
│ TTL: 3600000ms   │ │ Auto-managed   │
│ Manual invalidate │ │ Transparent    │
└──────────────────┘ └───────────────┘
    │                      │
    └──────────┬───────────┘
               │
          Hit Rate > 90%
          └─ Minimal database queries
          └─ Very fast responses
```

## Performance Guarantees

```
Index Usage
  Seq Scan ──▶ Add index ──▶ Index Scan
      ❌                          ✅

N+1 Queries
  Multiple queries ──▶ QueryBuilder ──▶ Single query
      ❌                                  ✅

Large Result Sets
  All rows ──▶ Add LIMIT ──▶ Fewer rows
      ❌                        ✅

Expensive Aggregations
  COUNT(*) ──▶ Denormalization ──▶ Direct column
      ❌                              ✅

Connection Exhaustion
  Too few ──▶ Tune pool ──▶ Adequate pool
      ❌                        ✓

Query Timeouts
  Slow ──▶ Optimize ──▶ Fast
  ❌                    ✓

RESULT: p95 < 50ms ✓
```

---

See [OPTIMIZATION_REPORT.md](./OPTIMIZATION_REPORT.md) for detailed metrics and [docs/database-profiling.md](./docs/database-profiling.md) for technical implementation details.

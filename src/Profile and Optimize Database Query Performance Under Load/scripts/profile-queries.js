#!/usr/bin/env node

/**
 * Query Profiling Script
 *
 * Uses pg_stat_statements to identify and report the slowest queries
 * Runs after load testing to get representative performance data
 *
 * Run: node scripts/profile-queries.js
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const config = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "query_optimization_db",
};

async function profileQueries() {
  const client = new Client(config);

  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL\n");

    // Check if pg_stat_statements is available
    const extensionCheck = await client.query(
      `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements') as installed;`,
    );

    if (!extensionCheck.rows[0].installed) {
      console.warn("⚠️  pg_stat_statements is not installed");
      console.warn("   Run: CREATE EXTENSION pg_stat_statements;");
      console.warn("   Or run: node scripts/setup-database.js\n");
    }

    // Get statistics
    await reportTopSlowQueries(client);
    await reportTopFrequentQueries(client);
    await reportNPlusOneIndicators(client);
    await reportIndexUsage(client);
    await generateReport(client);
  } catch (error) {
    console.error("❌ Error during profiling:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function reportTopSlowQueries(client) {
  console.log(
    "═══════════════════════════════════════════════════════════════════",
  );
  console.log("🐌 TOP 10 SLOWEST QUERIES (by total execution time)");
  console.log(
    "═══════════════════════════════════════════════════════════════════\n",
  );

  const result = await client.query(`
    SELECT
      query,
      calls,
      total_time::bigint as total_ms,
      mean_time::numeric(10,2)::float as mean_ms,
      max_time::numeric(10,2)::float as max_ms,
      min_time::numeric(10,2)::float as min_ms,
      rows
    FROM pg_stat_statements
    WHERE query NOT LIKE '%pg_stat_statements%'
      AND query NOT LIKE '%information_schema%'
      AND query NOT LIKE '%pg_catalog%'
    ORDER BY total_time DESC
    LIMIT 10;
  `);

  if (result.rows.length === 0) {
    console.log(
      "No slow queries found. Run load tests first: npm run load:test\n",
    );
    return;
  }

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];
    console.log(
      `${i + 1}. TOTAL TIME: ${row.total_ms}ms | CALLS: ${row.calls} | AVG: ${row.mean_ms}ms`,
    );
    console.log(
      `   Max: ${row.max_ms}ms | Min: ${row.min_ms}ms | Rows: ${row.rows}`,
    );
    console.log(`   Query: ${truncateQuery(row.query, 100)}`);
    console.log("");
  }
}

async function reportTopFrequentQueries(client) {
  console.log(
    "═══════════════════════════════════════════════════════════════════",
  );
  console.log("🔁 TOP 10 FREQUENTLY CALLED QUERIES");
  console.log(
    "═══════════════════════════════════════════════════════════════════\n",
  );

  const result = await client.query(`
    SELECT
      query,
      calls,
      total_time::bigint as total_ms,
      mean_time::numeric(10,2)::float as mean_ms,
      max_time::numeric(10,2)::float as max_ms
    FROM pg_stat_statements
    WHERE query NOT LIKE '%pg_stat_statements%'
      AND query NOT LIKE '%information_schema%'
    ORDER BY calls DESC
    LIMIT 10;
  `);

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];
    console.log(
      `${i + 1}. CALLS: ${row.calls} | TOTAL: ${row.total_ms}ms | AVG: ${row.mean_ms}ms | MAX: ${row.max_ms}ms`,
    );
    console.log(`   Query: ${truncateQuery(row.query, 100)}`);
    console.log("");
  }
}

async function reportNPlusOneIndicators(client) {
  console.log(
    "═══════════════════════════════════════════════════════════════════",
  );
  console.log("🔍 POTENTIAL N+1 QUERY PATTERNS (repeated similar queries)");
  console.log(
    "═══════════════════════════════════════════════════════════════════\n",
  );

  const result = await client.query(`
    SELECT
      regexp_replace(query, '\\$\\d+', '$X', 'g') as normalized_query,
      COUNT(*) as distinct_variations,
      SUM(calls) as total_calls,
      AVG(mean_time)::numeric(10,2)::float as avg_mean_ms,
      MAX(mean_time)::numeric(10,2)::float as max_mean_ms
    FROM pg_stat_statements
    WHERE query NOT LIKE '%pg_stat_statements%'
      AND query NOT LIKE '%information_schema%'
      AND query LIKE '%SELECT%'
    GROUP BY normalized_query
    HAVING COUNT(*) > 1
    ORDER BY total_calls DESC
    LIMIT 10;
  `);

  if (result.rows.length === 0) {
    console.log("✓ No obvious N+1 patterns detected\n");
    return;
  }

  console.warn("⚠️  Found potential N+1 patterns:\n");
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];
    console.log(
      `${i + 1}. Pattern with ${row.distinct_variations} variations | Total calls: ${row.total_calls}`,
    );
    console.log(
      `   Avg time: ${row.avg_mean_ms}ms | Max time: ${row.max_mean_ms}ms`,
    );
    console.log(`   Normalized: ${truncateQuery(row.normalized_query, 100)}`);
    console.log("");
  }
}

async function reportIndexUsage(client) {
  console.log(
    "═══════════════════════════════════════════════════════════════════",
  );
  console.log("📊 INDEX USAGE STATISTICS");
  console.log(
    "═══════════════════════════════════════════════════════════════════\n",
  );

  const result = await client.query(`
    SELECT
      tablename,
      indexname,
      idx_scan as scans,
      pg_size_pretty(pg_relation_size(indexrelid)) as size
    FROM pg_stat_user_indexes
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY idx_scan DESC;
  `);

  console.log("Used Indices:\n");
  for (const row of result.rows) {
    console.log(
      `${row.tablename}.${row.indexname}: ${row.scans} scans | Size: ${row.size}`,
    );
  }

  // Report unused indices
  console.log("\nUnused Indices (candidates for removal):\n");
  const unusedResult = await client.query(`
    SELECT
      tablename,
      indexname,
      pg_size_pretty(pg_relation_size(indexrelid)) as size
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0
      AND indexname NOT LIKE '%_pkey'
      AND schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY pg_relation_size(indexrelid) DESC;
  `);

  if (unusedResult.rows.length === 0) {
    console.log("✓ No unused indices found\n");
  } else {
    for (const row of unusedResult.rows) {
      console.warn(`⚠️  ${row.tablename}.${row.indexname}: ${row.size}`);
    }
    console.log("");
  }
}

async function generateReport(client) {
  console.log(
    "═══════════════════════════════════════════════════════════════════",
  );
  console.log("📈 PERFORMANCE SUMMARY");
  console.log(
    "═══════════════════════════════════════════════════════════════════\n",
  );

  // Get overall statistics
  const stats = await client.query(`
    SELECT
      COUNT(*) as total_queries,
      COUNT(DISTINCT LEFT(query, 50)) as distinct_query_patterns,
      SUM(calls) as total_calls,
      AVG(mean_time)::numeric(10,2)::float as avg_query_time_ms,
      MAX(mean_time)::numeric(10,2)::float as slowest_avg_query_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY mean_time)::numeric(10,2)::float as p95_query_time_ms,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY mean_time)::numeric(10,2)::float as p99_query_time_ms
    FROM pg_stat_statements
    WHERE query NOT LIKE '%pg_stat_statements%'
      AND query NOT LIKE '%information_schema%';
  `);

  const row = stats.rows[0];
  console.log(`Total Queries Tracked: ${row.total_queries}`);
  console.log(`Distinct Query Patterns: ${row.distinct_query_patterns}`);
  console.log(`Total Calls: ${row.total_calls}`);
  console.log(`Average Query Time: ${row.avg_query_time_ms}ms`);
  console.log(
    `P95 Query Time: ${row.p95_query_time_ms}ms${row.p95_query_time_ms > 50 ? " ⚠️" : " ✓"}`,
  );
  console.log(
    `P99 Query Time: ${row.p99_query_time_ms}ms${row.p99_query_time_ms > 100 ? " ⚠️" : " ✓"}`,
  );
  console.log(
    `Slowest Average: ${row.slowest_avg_query_ms}ms${row.slowest_avg_query_ms > 100 ? " ⚠️" : " ✓"}`,
  );

  // Table statistics
  const tableStats = await client.query(`
    SELECT
      tablename,
      n_live_tup as live_rows,
      n_dead_tup as dead_rows,
      last_vacuum,
      last_autovacuum
    FROM pg_stat_user_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY n_live_tup DESC;
  `);

  console.log("\nTable Statistics:\n");
  for (const row of tableStats.rows) {
    console.log(
      `${row.tablename}: ${row.live_rows} rows | Dead rows: ${row.dead_rows}`,
    );
  }

  console.log("\n✅ Profiling report generated\n");

  // Recommendations
  console.log(
    "═══════════════════════════════════════════════════════════════════",
  );
  console.log("💡 RECOMMENDATIONS");
  console.log(
    "═══════════════════════════════════════════════════════════════════\n",
  );

  if (row.p95_query_time_ms > 50) {
    console.warn("⚠️  P95 query time exceeds 50ms target");
    console.log("   → Review slow queries above");
    console.log("   → Consider adding indexes or optimizing queries\n");
  }

  if (unusedResult.rows.length > 0) {
    console.log("💡 Remove unused indices to improve write performance\n");
  }

  if (row.total_queries > 1000) {
    console.log(
      "💡 Monitor for query plan caching issues with high query count\n",
    );
  }

  console.log("Next steps:");
  console.log("1. Review slow queries above");
  console.log("2. Run EXPLAIN ANALYZE on top slow queries");
  console.log(
    "3. Check docs/database-profiling.md for optimization strategies",
  );
  console.log(
    "4. Reset stats and run load test again: npm run db:reset && npm run load:test\n",
  );
}

function truncateQuery(query, maxLength) {
  if (query.length > maxLength) {
    return query.substring(0, maxLength) + "...";
  }
  return query;
}

// Run profiling
profileQueries().catch(console.error);

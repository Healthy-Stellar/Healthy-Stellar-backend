#!/usr/bin/env node

/**
 * Database Setup Script
 *
 * Sets up the PostgreSQL database with:
 * 1. pg_stat_statements extension (for query profiling)
 * 2. Required tables and indices
 * 3. Test data for load testing
 *
 * Run: node scripts/setup-database.js
 * Environment: Requires DATABASE_URL or individual DB_* env vars
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
  connectionTimeoutMillis: 5000,
};

async function setupDatabase() {
  const client = new Client(config);

  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL");

    // 1. Enable pg_stat_statements extension
    console.log("\n📊 Setting up pg_stat_statements extension...");
    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS pg_stat_statements;");
      console.log("✓ pg_stat_statements extension enabled");
    } catch (error) {
      if (error.message.includes("permission denied")) {
        console.warn(
          "⚠️  Could not enable pg_stat_statements (requires superuser)",
        );
        console.warn("   Run manually: CREATE EXTENSION pg_stat_statements;");
      } else {
        throw error;
      }
    }

    // 2. Reset statistics to start fresh
    try {
      await client.query("SELECT pg_stat_statements_reset();");
      console.log("✓ pg_stat_statements statistics reset");
    } catch (error) {
      console.warn("⚠️  Could not reset pg_stat_statements");
    }

    // 3. Create tables (TypeORM will normally handle this with synchronize: true)
    console.log("\n📋 Creating tables...");
    await createTables(client);
    console.log("✓ Tables created/verified");

    // 4. Create optimized indices
    console.log("\n🔍 Creating indices...");
    await createIndices(client);
    console.log("✓ Indices created");

    // 5. Insert test data
    console.log("\n📝 Inserting test data...");
    const counts = await insertTestData(client);
    console.log(
      `✓ Test data inserted: ${counts.users} users, ${counts.records} records, ${counts.auditLogs} audit logs`,
    );

    // 6. Analyze tables for query planner optimization
    console.log("\n⚙️  Analyzing tables...");
    await client.query("ANALYZE users;");
    await client.query("ANALYZE records;");
    await client.query("ANALYZE audit_logs;");
    console.log("✓ Tables analyzed");

    // 7. Display database statistics
    console.log("\n📊 Database Statistics:");
    await displayDatabaseStats(client);

    console.log("\n✅ Database setup completed successfully!\n");
    console.log("Next steps:");
    console.log("1. Run: npm run start:dev");
    console.log("2. Run load test: npm run load:test");
    console.log("3. Profile queries: npm run load:test:slow-queries");
    console.log("4. Review metrics: https://docs/database-profiling.md");
  } catch (error) {
    console.error("❌ Error during database setup:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function createTables(client) {
  // Create users table
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      firstName VARCHAR(100) NOT NULL,
      lastName VARCHAR(100) NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create records table
  await client.query(`
    CREATE TABLE IF NOT EXISTS records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ownerId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      category VARCHAR(100),
      metadata JSONB,
      viewCount INTEGER DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create audit_logs table
  await client.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(100) NOT NULL,
      resourceType VARCHAR(255) NOT NULL,
      resourceId UUID,
      details JSONB,
      ipAddress VARCHAR(50),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function createIndices(client) {
  const indices = [
    // Users indices
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
    `CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);`,

    // Records indices
    `CREATE INDEX IF NOT EXISTS idx_records_owner_id ON records(ownerId);`,
    `CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);`,
    `CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(createdAt DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_records_status_created ON records(status, createdAt DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_records_view_count ON records(viewCount DESC) WHERE viewCount > 0;`,

    // Audit logs indices
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(userId);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(createdAt DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(userId, createdAt DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);`,
  ];

  for (const indexSql of indices) {
    try {
      await client.query(indexSql);
    } catch (error) {
      // Index might already exist, which is fine
      if (!error.message.includes("already exists")) {
        throw error;
      }
    }
  }
}

async function insertTestData(client) {
  const counts = { users: 0, records: 0, auditLogs: 0 };

  // Generate test users
  const userEmails = Array.from(
    { length: 10 },
    (_, i) => `user${i + 1}@example.com`,
  );

  for (const email of userEmails) {
    const result = await client.query(
      `INSERT INTO users (email, firstName, lastName) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO NOTHING 
       RETURNING id;`,
      [email, `User${Math.floor(Math.random() * 1000)}`, `${Math.random()}`],
    );
    if (result.rows.length > 0) {
      counts.users++;
    }
  }

  // Get all user IDs
  const usersResult = await client.query("SELECT id FROM users;");
  const userIds = usersResult.rows.map((row) => row.id);

  // Generate test records
  const statuses = ["active", "archived", "pending"];
  const categories = ["news", "blog", "tutorial", "documentation"];

  for (let i = 0; i < 100; i++) {
    const ownerId = userIds[Math.floor(Math.random() * userIds.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];

    try {
      await client.query(
        `INSERT INTO records (ownerId, title, description, status, category, viewCount) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          ownerId,
          `Record ${i + 1}`,
          `Description for record ${i + 1}. Lorem ipsum dolor sit amet.`,
          status,
          category,
          Math.floor(Math.random() * 1000),
        ],
      );
      counts.records++;
    } catch (error) {
      // Might fail if user was deleted, continue
    }
  }

  // Get all record IDs
  const recordsResult = await client.query("SELECT id FROM records;");
  const recordIds = recordsResult.rows.map((row) => row.id);

  // Generate test audit logs
  const actions = ["CREATE", "READ", "UPDATE", "DELETE"];
  const resourceTypes = ["RECORD", "USER", "AUDIT_LOG"];

  for (let i = 0; i < 500; i++) {
    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const resourceType =
      resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
    const resourceId =
      recordIds.length > 0
        ? recordIds[Math.floor(Math.random() * recordIds.length)]
        : null;

    try {
      await client.query(
        `INSERT INTO audit_logs (userId, action, resourceType, resourceId, details) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          action,
          resourceType,
          resourceId,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            path: "/api/test",
          }),
        ],
      );
      counts.auditLogs++;
    } catch (error) {
      // Continue on error
    }
  }

  return counts;
}

async function displayDatabaseStats(client) {
  const stats = await client.query(`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size,
      n_live_tup AS rows
    FROM pg_stat_user_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY tablename;
  `);

  console.log("Table Statistics:");
  for (const row of stats.rows) {
    console.log(`  ${row.tablename}: ${row.rows} rows, ${row.size}`);
  }

  // Display index information
  const indices = await client.query(`
    SELECT
      tablename,
      indexname,
      idx_scan AS scans
    FROM pg_stat_user_indexes
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY tablename, indexname;
  `);

  if (indices.rows.length > 0) {
    console.log("\nIndex Information:");
    for (const row of indices.rows) {
      console.log(`  ${row.tablename}.${row.indexname}: ${row.scans} scans`);
    }
  }
}

// Run setup
setupDatabase().catch(console.error);

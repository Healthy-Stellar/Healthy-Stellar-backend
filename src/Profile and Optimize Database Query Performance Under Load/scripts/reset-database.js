#!/usr/bin/env node

/**
 * Database Reset Script
 *
 * Completely resets the database (drops all tables and recreates them)
 * Resets pg_stat_statements statistics
 *
 * Run: node scripts/reset-database.js
 * WARNING: This will delete all data!
 */

const { Client } = require("pg");
const readline = require("readline");

const config = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "query_optimization_db",
};

async function confirmReset() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      "\n⚠️  WARNING: This will DELETE ALL DATA. Are you sure? (yes/no): ",
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "yes");
      },
    );
  });
}

async function resetDatabase() {
  const confirmed = await confirmReset();

  if (!confirmed) {
    console.log("Reset cancelled.");
    process.exit(0);
  }

  const client = new Client(config);

  try {
    await client.connect();
    console.log("\n🔄 Resetting database...\n");

    // Drop tables in correct order (due to foreign keys)
    const tables = ["audit_logs", "records", "users"];
    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
        console.log(`✓ Dropped table: ${table}`);
      } catch (error) {
        if (!error.message.includes("does not exist")) {
          throw error;
        }
      }
    }

    // Reset pg_stat_statements
    try {
      await client.query("SELECT pg_stat_statements_reset();");
      console.log("✓ Reset pg_stat_statements");
    } catch (error) {
      console.warn(
        "⚠️  Could not reset pg_stat_statements (may require superuser)",
      );
    }

    console.log("\n✅ Database reset completed!\n");
    console.log("Next steps:");
    console.log("1. Run: node scripts/setup-database.js");
    console.log("2. Run: npm run start:dev");
  } catch (error) {
    console.error("❌ Error during reset:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run reset
resetDatabase().catch(console.error);

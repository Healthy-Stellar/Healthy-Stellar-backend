import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { AuditLog } from "../modules/audit-log/entities/audit-log.entity";
import { Record } from "../modules/records/entities/record.entity";
import { User } from "../modules/users/entities/user.entity";

/**
 * TypeORM configuration with performance optimization settings
 * - Query logging enabled in development with 100ms slow query threshold
 * - Connection pooling tuned for load testing scenarios
 * - Eager loading strategies to prevent N+1 query issues
 */
export const getTypeOrmConfig = (): TypeOrmModuleOptions => {
  const isDevelopment = process.env.NODE_ENV !== "production";

  return {
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "query_optimization_db",
    entities: [AuditLog, Record, User],
    migrations: ["dist/migrations/*.js"],
    migrationsRun: true,
    synchronize: isDevelopment,
    logging: isDevelopment ? ["query", "error", "warn"] : ["error"],
    logger: "advanced-console",

    /**
     * Query logging configuration
     * - maxQueryExecutionTime: 100ms - logs queries slower than this threshold
     * - Cache configuration for frequently accessed data
     */
    maxQueryExecutionTime: 100,
    cache: {
      type: "database",
      duration: 3600000, // 1 hour cache duration
    },

    /**
     * Connection pool configuration
     * - Tuned based on load test concurrency findings
     * - Default: 50 min, 100 max
     * - Can be adjusted based on actual load test results
     */
    extra: {
      max: parseInt(process.env.DB_POOL_MAX || "100", 10),
      min: parseInt(process.env.DB_POOL_MIN || "50", 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      // Enable query timeout in milliseconds
      query_timeout: 15000,
      statement_timeout: 15000,
    },

    // Pooling configuration for better resource management under load
    poolSize: parseInt(process.env.DB_POOL_SIZE || "10", 10),
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  };
};

/**
 * Development-specific configuration for query profiling
 * Use this configuration when running profiling scripts
 */
export const getProfilingConfig = (): TypeOrmModuleOptions => {
  return {
    ...getTypeOrmConfig(),
    logging: ["query", "error", "warn", "migration"],
    maxQueryExecutionTime: 50, // More aggressive profiling threshold
  };
};

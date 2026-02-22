import { Injectable } from '@nestjs/common';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AuditSubscriber } from '../common/subscribers/audit.subscriber';

/**
 * TypeORM Database Configuration
 * HIPAA-Compliant PostgreSQL Configuration
 * 
 * Security Requirements:
 * - synchronize: false in ALL environments (schema changes via migrations only)
 * - SSL/TLS encryption for production
 * - Connection pooling with limits
 * - Query timeout enforcement
 * - Audit logging enabled
 */
@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const sslEnabled = this.configService.get<string>('DB_SSL_ENABLED', 'false') === 'true';

    // Validate required configuration
    const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME'];
    for (const varName of requiredVars) {
      if (!this.configService.get(varName)) {
        throw new Error(`Missing required database configuration: ${varName}`);
      }
    }

    return {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      username: this.configService.get<string>('DB_USERNAME'),
      password: this.configService.get<string>('DB_PASSWORD'),
      database: this.configService.get<string>('DB_NAME'),

      // SSL/TLS Configuration for encrypted connections (HIPAA requirement)
      ssl: sslEnabled
        ? {
            rejectUnauthorized: isProduction,
            ca: this.configService.get<string>('DB_SSL_CA'),
            cert: this.configService.get<string>('DB_SSL_CERT'),
            key: this.configService.get<string>('DB_SSL_KEY'),
          }
        : false,

      // Entity and Migration paths
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      subscribers: [AuditSubscriber],

      // CRITICAL: synchronize MUST be false in ALL environments
      // All schema changes MUST go through versioned migrations
      synchronize: false,

      // Migrations should be run manually with proper audit trail
      migrationsRun: false,

      // Logging configuration for audit trail
      logging: isProduction ? ['error', 'warn', 'migration'] : ['query', 'error', 'warn', 'migration'],
      logger: 'advanced-console',

      // Connection pool configuration for HIPAA compliance
      extra: {
        // Maximum connection pool size
        max: this.configService.get<number>('DB_POOL_MAX', 20),
        // Minimum connection pool size
        min: this.configService.get<number>('DB_POOL_MIN', 2),
        // Connection timeout (30 seconds)
        connectionTimeoutMillis: 30000,
        // Idle timeout (10 minutes) - automatically close idle connections
        idleTimeoutMillis: 600000,
        // Statement timeout (60 seconds) - prevent long-running queries
        statement_timeout: 60000,
        // Application name for audit logging
        application_name: 'healthy-stellar-backend',
        // Enable SSL mode
        ...(sslEnabled && { sslmode: 'require' }),
      },

      // Connection retry strategy
      retryAttempts: 3,
      retryDelay: 3000,

      // Transaction management - log slow queries
      maxQueryExecutionTime: 10000,

      // Enable automatic query result caching
      cache: {
        type: 'database',
        tableName: 'query_cache',
        duration: 60000, // 1 minute
      },
    };
  }
}

/**
 * DataSource configuration for TypeORM CLI (migrations)
 * Used by: npm run migration:generate, migration:run, migration:revert
 * 
 * Configuration is loaded from environment variables via DATABASE_URL or individual vars
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  
  // Support DATABASE_URL for simplified configuration
  url: process.env.DATABASE_URL,
  
  // Fallback to individual environment variables
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // SSL Configuration
  ssl:
    process.env.DB_SSL_ENABLED === 'true'
      ? {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
          ca: process.env.DB_SSL_CA,
          cert: process.env.DB_SSL_CERT,
          key: process.env.DB_SSL_KEY,
        }
      : false,

  // Entity and Migration paths
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  subscribers: [AuditSubscriber],

  // CRITICAL: synchronize MUST be false
  synchronize: false,
  
  // Enable logging in development
  logging: process.env.NODE_ENV !== 'production',
};

// Export configured DataSource for CLI
export default new DataSource(dataSourceOptions);

import { Injectable } from '@nestjs/common';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AuditSubscriber } from '../common/subscribers/audit.subscriber';
import { createTypeOrmRetryCallback, MAX_RETRIES, RETRY_DELAY_MS } from '../common/utils/connection-retry.util';

/**
 * TypeORM Database Configuration
 *
 * Acceptance criteria (#208):
 * - TypeORM configured via @nestjs/typeorm and ConfigService
 * - Connection pool: min: 2, max: 10
 * - synchronize: false in all environments (migrations only)
 * - logging: ['error'] in production, ['query', 'error'] in development
 * - SSL enabled for production database connection
 */
@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

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

      // SSL: always enabled in production; opt-in via DB_SSL_ENABLED in other envs
      ssl: isProduction
        ? {
            rejectUnauthorized: true,
            ca: this.configService.get<string>('DB_SSL_CA'),
            cert: this.configService.get<string>('DB_SSL_CERT'),
            key: this.configService.get<string>('DB_SSL_KEY'),
          }
        : this.configService.get<string>('DB_SSL_ENABLED') === 'true'
          ? {
              rejectUnauthorized: false,
              ca: this.configService.get<string>('DB_SSL_CA'),
            }
          : false,

      // Entity and Migration paths
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      subscribers: [AuditSubscriber],

      // CRITICAL: synchronize MUST be false in ALL environments
      synchronize: false,
      migrationsRun: false,

      // logging: ['error'] in production, ['query', 'error'] in development
      logging: isProduction ? ['error'] : ['query', 'error'],

      // Connection pool: min 2, max 10
      extra: {
        max: this.configService.get<number>('DB_POOL_MAX', 10),
        min: this.configService.get<number>('DB_POOL_MIN', 2),
        connectionTimeoutMillis: this.configService.get<number>('DB_CONNECTION_TIMEOUT_MS', 2000),
        idleTimeoutMillis: this.configService.get<number>('DB_IDLE_TIMEOUT_MS', 30000),
        statement_timeout: 60000,
        application_name: 'healthy-stellar-backend',
      },

      retryAttempts: MAX_RETRIES,
      retryDelay: RETRY_DELAY_MS,
      toRetry: createTypeOrmRetryCallback(),

      maxQueryExecutionTime: this.configService.get<number>('DB_SLOW_QUERY_MS', 100),
    };
  }
}

/**
 * DataSource configuration for TypeORM CLI (migrations).
 * Used by: npm run migration:run, migration:revert, migration:generate
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // SSL enabled for production
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: true }
      : process.env.DB_SSL_ENABLED === 'true'
        ? { rejectUnauthorized: false }
        : false,

  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  subscribers: [AuditSubscriber],

  synchronize: false,

  logging:
    process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error'],

  maxQueryExecutionTime: parseInt(process.env.DB_SLOW_QUERY_MS || '100', 10),
};

// Export configured DataSource for CLI
export default new DataSource(dataSourceOptions);

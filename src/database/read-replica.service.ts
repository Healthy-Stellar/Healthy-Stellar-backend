import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

/**
 * Read-replica connection seam for analytics / reporting workloads.
 *
 * Heavy aggregate queries (cohort analysis, readmission-rate and
 * length-of-stay reports) should not compete with OLTP traffic on the
 * primary database. This service exposes a secondary, read-only TypeORM
 * `DataSource` that callers use instead of the default `@InjectDataSource()`
 * / `@InjectRepository()` connection.
 *
 * Configuration (all optional):
 *   DB_REPLICA_URL or DB_REPLICA_HOST / DB_REPLICA_PORT / DB_REPLICA_USERNAME /
 *   DB_REPLICA_PASSWORD / DB_REPLICA_NAME / DB_REPLICA_POOL_MIN / DB_REPLICA_POOL_MAX
 *
 * If no replica connection details are provided (the common case for local
 * development and most CI environments) this service transparently falls
 * back to the primary `DataSource` so callers always get a working
 * connection. The seam itself is real, though: pointing DB_REPLICA_* at an
 * actual standby/read-replica Postgres instance routes analytics traffic
 * there with no further code changes. Provisioning that physical replica is
 * an infrastructure concern outside the scope of this service.
 */
@Injectable()
export class ReadReplicaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadReplicaService.name);
  private replicaDataSource: DataSource | null = null;
  private usingReplica = false;

  constructor(
    @InjectDataSource() private readonly primaryDataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const options = this.buildReplicaOptions();
    if (!options) {
      this.logger.warn(
        'No DB_REPLICA_* configuration found — analytics queries will fall back to the primary database connection.',
      );
      return;
    }

    try {
      const dataSource = new DataSource(options);
      await dataSource.initialize();
      this.replicaDataSource = dataSource;
      this.usingReplica = true;
      this.logger.log('Read-replica connection established for analytics workloads.');
    } catch (error) {
      this.logger.error(
        `Failed to initialize read-replica connection, falling back to primary database: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.replicaDataSource = null;
      this.usingReplica = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.replicaDataSource?.isInitialized) {
      await this.replicaDataSource.destroy();
    }
  }

  /** True when a dedicated replica connection is actually in use (not the primary fallback). */
  isUsingReplica(): boolean {
    return this.usingReplica;
  }

  /** The active DataSource — the replica when configured/healthy, otherwise the primary. */
  getDataSource(): DataSource {
    return this.replicaDataSource ?? this.primaryDataSource;
  }

  /** Convenience helper mirroring `DataSource#getRepository` against the active connection. */
  getRepository<Entity extends ObjectLiteral>(entity: EntityTarget<Entity>): Repository<Entity> {
    return this.getDataSource().getRepository(entity);
  }

  private buildReplicaOptions(): DataSourceOptions | null {
    const url = this.configService.get<string>('DB_REPLICA_URL');
    const host = this.configService.get<string>('DB_REPLICA_HOST');

    if (!url && !host) {
      return null;
    }

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    return {
      type: 'postgres',
      name: 'analytics-read-replica',
      url,
      host: host || undefined,
      port: this.configService.get<number>('DB_REPLICA_PORT', 5432),
      username:
        this.configService.get<string>('DB_REPLICA_USERNAME') ||
        this.configService.get<string>('DB_USERNAME'),
      password:
        this.configService.get<string>('DB_REPLICA_PASSWORD') ||
        this.configService.get<string>('DB_PASSWORD'),
      database:
        this.configService.get<string>('DB_REPLICA_NAME') ||
        this.configService.get<string>('DB_NAME'),
      ssl: isProduction
        ? { rejectUnauthorized: true }
        : this.configService.get<string>('DB_SSL_ENABLED') === 'true'
          ? { rejectUnauthorized: false }
          : false,
      // Read-only analytics connection: small dedicated pool, no migrations/sync.
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: false,
      migrationsRun: false,
      logging: ['error'],
      extra: {
        max: this.configService.get<number>('DB_REPLICA_POOL_MAX', 5),
        min: this.configService.get<number>('DB_REPLICA_POOL_MIN', 1),
        application_name: 'healthy-stellar-backend-analytics-replica',
      },
    } as DataSourceOptions;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, MigrationExecutor } from 'typeorm';

@Injectable()
export class MigrationCliService {
  private readonly logger = new Logger(MigrationCliService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async run(): Promise<{ migrationsRan: string[]; duration: number }> {
    const startTime = Date.now();
    const migrationsRan: string[] = [];

    const executor = new MigrationExecutor(this.dataSource);
    const pendingMigrations = await executor.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      this.logger.log('No pending migrations to run.');
      return { migrationsRan, duration: Date.now() - startTime };
    }

    this.logger.log(
      `Found ${pendingMigrations.length} pending migration(s): ${pendingMigrations
        .map((m) => m.name)
        .join(', ')}`,
    );

    for (const migration of pendingMigrations) {
      const migrationStart = Date.now();
      try {
        await executor.executeMigration(migration, 'each');
        const migrationDuration = Date.now() - migrationStart;
        migrationsRan.push(migration.name);
        this.logger.log(
          `Migration ${migration.name} completed in ${migrationDuration}ms`,
        );
      } catch (error) {
        const migrationDuration = Date.now() - migrationStart;
        this.logger.error(
          `Migration ${migration.name} failed after ${migrationDuration}ms: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        throw error;
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Ran ${migrationsRan.length} migration(s) in ${duration}ms`,
    );

    return { migrationsRan, duration };
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableQueryPerformanceMonitoring1775300000000 implements MigrationInterface {
  name = 'EnableQueryPerformanceMonitoring1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pg_stat_statements extension for query performance monitoring
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`);

    // Create index on pg_stat_statements for faster slow query lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pg_stat_statements_mean_exec_time 
      ON pg_stat_statements(mean_exec_time DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pg_stat_statements_mean_exec_time;`);

    // Note: We don't drop pg_stat_statements extension as it may be used by other tools
    // await queryRunner.query(`DROP EXTENSION IF EXISTS pg_stat_statements;`);
  }
}

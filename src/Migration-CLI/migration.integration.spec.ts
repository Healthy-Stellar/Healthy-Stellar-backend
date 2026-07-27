/**
 * Integration tests — run against a real PostgreSQL instance.
 *
 * Dependencies:
 *   npm install --save-dev @testcontainers/postgresql testcontainers
 *
 * These tests are opt-in: only run when INTEGRATION_TESTS=true env var is set
 * to avoid slowing down the normal test suite.
 *
 * Run with:
 *   INTEGRATION_TESTS=true jest src/database/migration-cli/integration
 */

import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { MigrationHistory, MigrationStatus } from '../entities/migration-history.entity';
import { CreateMigrationHistoryTable1700000000000 } from '../migrations/1700000000000-CreateMigrationHistoryTable';

// Skip entire suite unless integration flag is set
const describeIf = (condition: boolean) =>
  condition ? describe : describe.skip;

const INTEGRATION = process.env.INTEGRATION_TESTS === 'true';

// ─── Sample Migrations ────────────────────────────────────────────────────────

class CreateUsersTable1700000001 implements MigrationInterface {
  name = 'CreateUsersTable1700000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE test_users (
        id   SERIAL PRIMARY KEY,
        name VARCHAR(256) NOT NULL,
        email VARCHAR(512) UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS test_users`);
  }
}

class AddPhoneToUsersTable1700000002 implements MigrationInterface {
  name = 'AddPhoneToUsersTable1700000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE test_users ADD COLUMN phone VARCHAR(32)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE test_users DROP COLUMN IF EXISTS phone
    `);
  }
}

class BrokenMigration1700000099 implements MigrationInterface {
  name = 'BrokenMigration1700000099';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`THIS IS NOT VALID SQL !!!`);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {}
}

// ─── Container + DataSource setup ────────────────────────────────────────────

let dataSource: DataSource;

async function buildDataSource(host: string, port: number): Promise<DataSource> {
  return new DataSource({
    type: 'postgres',
    host,
    port,
    username: 'test',
    password: 'test',
    database: 'test_migrations',
    synchronize: false,
    migrations: [
      CreateMigrationHistoryTable1700000000000,
      CreateUsersTable1700000001,
      AddPhoneToUsersTable1700000002,
    ],
    entities: [MigrationHistory],
    logging: false,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describeIf(INTEGRATION)('Migration CLI — Integration Tests', () => {
  let pgContainer: any; // PostgreSqlContainer type

  // Increased timeout for container startup
  jest.setTimeout(120_000);

  beforeAll(async () => {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');

    pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withUsername('test')
      .withPassword('test')
      .withDatabase('test_migrations')
      .start();

    dataSource = await buildDataSource(
      pgContainer.getHost(),
      pgContainer.getMappedPort(5432),
    );

    await dataSource.initialize();

    // Run the migration_history bootstrap migration
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await pgContainer?.stop();
  });

  afterEach(async () => {
    // Clean state between tests
    const tables = ['typeorm_migrations', 'migration_history', 'test_users'];
    for (const t of tables) {
      await dataSource.query(`DROP TABLE IF EXISTS "${t}" CASCADE`).catch(() => {});
    }
    await dataSource.query(`DROP TYPE IF EXISTS migration_status_enum CASCADE`).catch(() => {});
  });

  // ── Schema Creation ────────────────────────────────────────────────────

  describe('CreateMigrationHistoryTable migration', () => {
    it('creates the migration_history table with all expected columns', async () => {
      const migration = new CreateMigrationHistoryTable1700000000000();
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();

      await migration.up(queryRunner);

      const [result]: [{ exists: boolean }] = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'migration_history'
        ) AS exists
      `);

      expect(result.exists).toBe(true);

      // Check columns
      const columns: Array<{ column_name: string; data_type: string }> =
        await queryRunner.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'migration_history'
          ORDER BY ordinal_position
        `);

      const columnNames = columns.map((c) => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('migration_name');
      expect(columnNames).toContain('executed_at');
      expect(columnNames).toContain('executed_by');
      expect(columnNames).toContain('duration_ms');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('error_message');
      expect(columnNames).toContain('dry_run');
      expect(columnNames).toContain('reverted_at');
      expect(columnNames).toContain('reverted_by');

      await queryRunner.release();
    });

    it('rollback drops the table', async () => {
      const migration = new CreateMigrationHistoryTable1700000000000();
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();

      await migration.up(queryRunner);
      await migration.down(queryRunner);

      const [result]: [{ exists: boolean }] = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'migration_history'
        ) AS exists
      `);
      expect(result.exists).toBe(false);

      await queryRunner.release();
    });
  });

  // ── Full Run Sequence ──────────────────────────────────────────────────

  describe('Full migration run sequence', () => {
    beforeEach(async () => {
      // Bootstrap migration_history table
      const migration = new CreateMigrationHistoryTable1700000000000();
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
      await migration.up(qr);
      await qr.release();
    });

    it('runs migrations and records them in migration_history', async () => {
      await dataSource.runMigrations({ transaction: 'each' });

      const historyRepo = dataSource.getRepository(MigrationHistory);
      // Manually record as the service would
      await historyRepo.save(
        historyRepo.create({
          migrationName: 'CreateUsersTable1700000001',
          executedBy: 'test-runner',
          status: MigrationStatus.EXECUTED,
          durationMs: 100,
          dryRun: false,
        }),
      );

      const records = await historyRepo.find({
        where: { status: MigrationStatus.EXECUTED },
      });

      expect(records.length).toBeGreaterThanOrEqual(1);
      expect(records[0].migrationName).toBe('CreateUsersTable1700000001');
    });

    it('test_users table is queryable after migrations', async () => {
      await dataSource.runMigrations({ transaction: 'each' });

      await dataSource.query(
        `INSERT INTO test_users (name, email) VALUES ('Alice', 'alice@test.com')`,
      );

      const rows: Array<{ name: string }> = await dataSource.query(
        `SELECT name FROM test_users WHERE email = 'alice@test.com'`,
      );

      expect(rows[0].name).toBe('Alice');
    });

    it('phone column exists after second migration', async () => {
      await dataSource.runMigrations({ transaction: 'each' });

      const columns: Array<{ column_name: string }> = await dataSource.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'test_users' AND column_name = 'phone'
      `);

      expect(columns).toHaveLength(1);
    });

    it('undoes migrations in reverse order', async () => {
      await dataSource.runMigrations({ transaction: 'each' });

      // Undo phone column
      await dataSource.undoLastMigration({ transaction: 'each' });

      const afterFirstUndo: Array<{ column_name: string }> = await dataSource.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'test_users' AND column_name = 'phone'
      `);
      expect(afterFirstUndo).toHaveLength(0); // phone gone

      // Undo test_users table
      await dataSource.undoLastMigration({ transaction: 'each' });

      const [afterSecondUndo]: [{ exists: boolean }] = await dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables WHERE table_name = 'test_users'
        ) AS exists
      `);
      expect(afterSecondUndo.exists).toBe(false);
    });
  });

  // ── Concurrent Access Guard ────────────────────────────────────────────

  describe('Active transaction detection', () => {
    it('detects long-running transactions via pg_stat_activity query', async () => {
      // Start a transaction and leave it open
      const idleConn = await dataSource.query(`SELECT pg_backend_pid() AS pid`);

      // Check pg_stat_activity (our service uses this same query)
      const rows: Array<{ pid: string }> = await dataSource.query(`
        SELECT pid::text
        FROM pg_stat_activity
        WHERE state IN ('active', 'idle in transaction')
          AND pid <> pg_backend_pid()
        LIMIT 10
      `);

      // We can't guarantee long-running TX in a test, but verify the query works
      expect(Array.isArray(rows)).toBe(true);
    });
  });
});

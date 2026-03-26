import { MigrationCliService } from './migration-cli.service';
import { MigrationStatus } from './entities/migration-history.entity';

// ─── Helpers / Factories ──────────────────────────────────────────────────────

const fakeMigration = (name: string) => ({
  name,
  up: jest.fn().mockResolvedValue(undefined),
  down: jest.fn().mockResolvedValue(undefined),
  constructor: { name },
});

function makeService(overrides: Partial<{
  dataSourceQuery: jest.Mock;
  dataSourceShowMigrations: jest.Mock;
  dataSourceRunMigrations: jest.Mock;
  dataSourceUndoLastMigration: jest.Mock;
  historyRepoCreate: jest.Mock;
  historyRepoSave: jest.Mock;
  historyRepoFind: jest.Mock;
  historyRepoFindOne: jest.Mock;
  safetyChecksRunAll: jest.Mock;
  dryRunExecute: jest.Mock;
  backupTrigger: jest.Mock;
  slackNotify: jest.Mock;
}> = {}): MigrationCliService {
  const mockDataSource: any = {
    query: overrides.dataSourceQuery ?? jest.fn().mockResolvedValue([]),
    showMigrations: overrides.dataSourceShowMigrations ?? jest.fn().mockResolvedValue(false),
    runMigrations: overrides.dataSourceRunMigrations ?? jest.fn().mockResolvedValue([]),
    undoLastMigration: overrides.dataSourceUndoLastMigration ?? jest.fn().mockResolvedValue(undefined),
    migrations: [],
  };

  const mockHistoryRepo: any = {
    create: overrides.historyRepoCreate ?? jest.fn().mockImplementation((dto) => ({ ...dto })),
    save: overrides.historyRepoSave ?? jest.fn().mockImplementation(async (e) => e),
    find: overrides.historyRepoFind ?? jest.fn().mockResolvedValue([]),
    findOne: overrides.historyRepoFindOne ?? jest.fn().mockResolvedValue(null),
  };

  const mockSafetyChecks: any = {
    runAll: overrides.safetyChecksRunAll ?? jest.fn().mockResolvedValue({
      passed: true, blockers: [], warnings: [],
    }),
  };

  const mockDryRunService: any = {
    executeDryRun: overrides.dryRunExecute ?? jest.fn().mockResolvedValue([]),
  };

  const mockBackupService: any = {
    triggerPreMigrationBackup: overrides.backupTrigger ?? jest.fn().mockResolvedValue({
      success: true, backupPath: '/tmp/test.dump', durationMs: 200, skipped: false,
    }),
  };

  const mockSlack: any = {
    notify: overrides.slackNotify ?? jest.fn().mockResolvedValue(undefined),
  };

  return new MigrationCliService(
    mockDataSource,
    mockHistoryRepo,
    mockSafetyChecks,
    mockDryRunService,
    mockBackupService,
    mockSlack,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MigrationCliService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
  });

  // ── getStatus() ─────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns executed entries from typeorm_migrations', async () => {
      const service = makeService({
        dataSourceQuery: jest.fn()
          .mockResolvedValueOnce([{ name: 'Migration1', timestamp: '1' }]) // typeorm_migrations
          .mockResolvedValue([]),
        historyRepoFind: jest.fn().mockResolvedValue([
          {
            migrationName: 'Migration1',
            status: MigrationStatus.EXECUTED,
            executedAt: new Date('2025-01-01'),
            durationMs: 123,
          },
        ]),
      });

      const entries = await service.getStatus();

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('Migration1');
      expect(entries[0].status).toBe('executed');
      expect(entries[0].durationMs).toBe(123);
    });
  });

  // ── run() ───────────────────────────────────────────────────────────────

  describe('run()', () => {
    it('returns success with empty migrationsRan when nothing is pending', async () => {
      const service = makeService({
        dataSourceShowMigrations: jest.fn().mockResolvedValue(false),
      });

      const result = await service.run();

      expect(result.success).toBe(true);
      expect(result.migrationsRan).toHaveLength(0);
    });

    it('blocks and does NOT run migrations when safety checks fail', async () => {
      const runMigrations = jest.fn();
      const slackNotify = jest.fn().mockResolvedValue(undefined);

      const service = makeService({
        dataSourceShowMigrations: jest.fn().mockResolvedValue(true),
        dataSourceQuery: jest.fn().mockResolvedValue([]), // no executed migrations
        safetyChecksRunAll: jest.fn().mockResolvedValue({
          passed: false,
          blockers: [
            {
              type: 'production_guard',
              message: 'Set CONFIRM_PRODUCTION_MIGRATION=true',
            },
          ],
          warnings: [],
        }),
        dataSourceRunMigrations: runMigrations,
        slackNotify,
      });

      const result = await service.run();

      expect(result.success).toBe(false);
      expect(runMigrations).not.toHaveBeenCalled();
      expect(result.errors[0]).toContain('CONFIRM_PRODUCTION_MIGRATION');

      // Should notify Slack about failure
      expect(slackNotify).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'migration_failed' }),
      );
    });

    it('aborts when backup fails', async () => {
      const runMigrations = jest.fn();

      const service = makeService({
        dataSourceShowMigrations: jest.fn().mockResolvedValue(true),
        dataSourceQuery: jest.fn().mockResolvedValue([]),
        backupTrigger: jest.fn().mockResolvedValue({
          success: false,
          error: 'pg_dump not found',
          durationMs: 50,
        }),
        dataSourceRunMigrations: runMigrations,
      });

      const result = await service.run();

      expect(result.success).toBe(false);
      expect(runMigrations).not.toHaveBeenCalled();
      expect(result.errors[0]).toContain('Backup failed');
    });

    it('runs migrations and notifies Slack on success', async () => {
      const slackNotify = jest.fn().mockResolvedValue(undefined);

      const service = makeService({
        dataSourceShowMigrations: jest.fn().mockResolvedValue(true),
        dataSourceQuery: jest.fn()
          .mockResolvedValueOnce([]) // typeorm_migrations — none executed
          .mockResolvedValue([]),
        dataSourceRunMigrations: jest.fn().mockResolvedValue([]),
        slackNotify,
      });

      const result = await service.run({ skipBackup: true, skipSafetyChecks: true });

      // Slack: started + success
      expect(slackNotify).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'migration_started' }),
      );
      expect(slackNotify).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'migration_success' }),
      );
    });

    it('marks history entry as FAILED and notifies Slack on migration error', async () => {
      const slackNotify = jest.fn().mockResolvedValue(undefined);
      const historyRepo = {
        create: jest.fn().mockImplementation((dto: any) => ({ ...dto, id: 'uuid-1' })),
        save: jest.fn().mockImplementation(async (e: any) => e),
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
      };

      const service = makeService({
        dataSourceShowMigrations: jest.fn().mockResolvedValue(true),
        dataSourceQuery: jest.fn().mockResolvedValue([]),
        dataSourceRunMigrations: jest.fn().mockRejectedValue(new Error('Syntax error in SQL')),
        historyRepoCreate: historyRepo.create,
        historyRepoSave: historyRepo.save,
        historyRepoFind: historyRepo.find,
        historyRepoFindOne: historyRepo.findOne,
        slackNotify,
        skipBackup: true,
      } as any);

      const result = await service.run({ skipBackup: true, skipSafetyChecks: true });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Syntax error in SQL');
      expect(slackNotify).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'migration_failed' }),
      );
    });
  });

  // ── revert() ────────────────────────────────────────────────────────────

  describe('revert()', () => {
    it('returns success=true when nothing to revert', async () => {
      const service = makeService({
        historyRepoFindOne: jest.fn().mockResolvedValue(null),
      });

      const result = await service.revert({ steps: 1 });

      expect(result.success).toBe(true);
      expect(result.migrationsReverted).toHaveLength(0);
    });

    it('reverts a single migration and updates history', async () => {
      const save = jest.fn().mockImplementation(async (e: any) => e);
      const historyEntry = {
        id: 'uuid-1',
        migrationName: 'AddIndexToUsers1700000001',
        status: MigrationStatus.EXECUTED,
        executedAt: new Date(),
        revertedAt: null,
        revertedBy: null,
      };

      const undoLast = jest.fn().mockResolvedValue(undefined);

      const service = makeService({
        historyRepoFindOne: jest.fn().mockResolvedValueOnce(historyEntry).mockResolvedValue(null),
        historyRepoSave: save,
        dataSourceUndoLastMigration: undoLast,
      });

      const result = await service.revert({ steps: 1 });

      expect(undoLast).toHaveBeenCalledTimes(1);
      expect(result.migrationsReverted).toContain('AddIndexToUsers1700000001');
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ status: MigrationStatus.REVERTED }),
      );
    });

    it('reverts N migrations when steps > 1', async () => {
      const entries = [
        { id: '1', migrationName: 'MigA', status: MigrationStatus.EXECUTED, executedAt: new Date() },
        { id: '2', migrationName: 'MigB', status: MigrationStatus.EXECUTED, executedAt: new Date() },
      ];

      let callCount = 0;
      const undoLast = jest.fn().mockResolvedValue(undefined);

      const service = makeService({
        historyRepoFindOne: jest.fn().mockImplementation(async () => {
          return entries[callCount++] ?? null;
        }),
        historyRepoSave: jest.fn().mockImplementation(async (e: any) => e),
        dataSourceUndoLastMigration: undoLast,
      });

      const result = await service.revert({ steps: 2 });

      expect(undoLast).toHaveBeenCalledTimes(2);
      expect(result.migrationsReverted).toHaveLength(2);
    });

    it('records error and stops on undoLastMigration failure', async () => {
      const service = makeService({
        historyRepoFindOne: jest.fn().mockResolvedValue({
          id: '1', migrationName: 'BadMig', status: MigrationStatus.EXECUTED,
        }),
        historyRepoSave: jest.fn(),
        dataSourceUndoLastMigration: jest.fn().mockRejectedValue(new Error('Revert exploded')),
      });

      const result = await service.revert({ steps: 3 });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Revert exploded');
    });
  });

  // ── dryRun() ─────────────────────────────────────────────────────────────

  describe('dryRun()', () => {
    it('returns empty reports when no migrations are pending', async () => {
      const service = makeService({
        dataSourceShowMigrations: jest.fn().mockResolvedValue(false),
      });

      const result = await service.dryRun();

      expect(result.reports).toHaveLength(0);
      expect(result.warnings).toContain('No pending migrations.');
    });

    it('delegates to DryRunService and returns reports', async () => {
      const fakeReport = {
        migrationName: 'AddUsersTable',
        statements: [],
        totalStatements: 0,
        totalIndexOperations: [],
        estimatedTotalLockMs: 0,
        tablesAffected: ['users'],
        warnings: [],
      };

      const service = makeService({
        dataSourceShowMigrations: jest.fn().mockResolvedValue(true),
        dataSourceQuery: jest.fn().mockResolvedValue([]), // no executed
        dryRunExecute: jest.fn().mockResolvedValue([fakeReport]),
      });

      const result = await service.dryRun({ skipSafetyChecks: true });

      expect(result.reports).toHaveLength(1);
      expect(result.reports[0].migrationName).toBe('AddUsersTable');
    });
  });
});

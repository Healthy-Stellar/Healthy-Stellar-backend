import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';
import { BackupService } from './backup.service';
import { BackupMonitoringService } from './backup-monitoring.service';
import { BackupLog, BackupStatus } from '../entities/backup-log.entity';
import { RecoveryTest } from '../entities/recovery-test.entity';

describe('BackupService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  async function buildModule(): Promise<TestingModule> {
    return Test.createTestingModule({
      providers: [
        BackupService,
        {
          provide: getRepositoryToken(BackupLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();
  }

  it('throws immediately when BACKUP_ENCRYPTION_KEY is missing', async () => {
    process.env = {
      ...originalEnv,
      BACKUP_ENCRYPTION_KEY: '',
    };

    await expect(buildModule()).rejects.toThrow(
      'BACKUP_ENCRYPTION_KEY environment variable is required for BackupService',
    );
  });

  it('initialises when BACKUP_ENCRYPTION_KEY is set', async () => {
    process.env = {
      ...originalEnv,
      BACKUP_ENCRYPTION_KEY: 'test-backup-key',
    };

    const module = await buildModule();

    expect(module.get(BackupService)).toBeInstanceOf(BackupService);
  });
});

/**
 * #951 — these services target Postgres through TypeORM, but the date bounds
 * were written as MongoDB operator objects (`{ $lt: date }`, `{ $gte: date }`)
 * and cast with `as any`, which silenced the type error. TypeORM does not
 * interpret those, so the filters never did what they read as.
 *
 * The assertions look at the `where` clause actually handed to the repository,
 * so they fail if anyone reintroduces a raw operator object.
 */

/** A repository double that records the `where` clause it was handed. */
function makeRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    remove: jest.fn(),
  };
}

/** The `where` clause from the first find() call. */
function whereOf(repo: ReturnType<typeof makeRepo>) {
  return repo.find.mock.calls[0][0].where;
}

describe('BackupService.cleanupOldBackups — TypeORM operators (#951)', () => {
  const originalEnv = { ...process.env };
  let repo: ReturnType<typeof makeRepo>;

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  async function runCleanup() {
    process.env = { ...originalEnv, BACKUP_ENCRYPTION_KEY: 'test-backup-key' };
    repo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: getRepositoryToken(BackupLog), useValue: repo },
      ],
    }).compile();
    const service = module.get(BackupService);
    // cleanupOldBackups is private, and is the only path that reaches find()
    // with a date bound — which is what this issue is about.
    await (service as any).cleanupOldBackups();
  }

  it('queries with a TypeORM FindOperator, not a raw Mongo object', async () => {
    await runCleanup();
    expect(repo.find).toHaveBeenCalledTimes(1);
    expect(whereOf(repo).startedAt).toBeInstanceOf(FindOperator);
  });

  it('uses the lessThan operator, so old backups are the ones selected', async () => {
    await runCleanup();
    expect((whereOf(repo).startedAt as FindOperator<Date>).type).toBe('lessThan');
  });

  it('sends no Mongo-style operator key', async () => {
    await runCleanup();
    expect(Object.keys(whereOf(repo).startedAt as object)).not.toContain('$lt');
  });

  it('still filters on COMPLETED backups only', async () => {
    await runCleanup();
    expect(whereOf(repo).status).toBe(BackupStatus.COMPLETED);
  });
});

describe('BackupMonitoringService — TypeORM operators (#951)', () => {
  const originalEnv = { ...process.env };
  let repo: ReturnType<typeof makeRepo>;

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  async function buildService() {
    process.env = { ...originalEnv, BACKUP_ENCRYPTION_KEY: 'test-backup-key' };
    repo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupMonitoringService,
        { provide: getRepositoryToken(BackupLog), useValue: repo },
        { provide: getRepositoryToken(RecoveryTest), useValue: makeRepo() },
      ],
    }).compile();
    return module.get(BackupMonitoringService);
  }

  it('getBackupStatistics uses a moreThanOrEqual operator', async () => {
    const service = await buildService();
    await service.getBackupStatistics(30);

    const startedAt = whereOf(repo).startedAt;
    expect(startedAt).toBeInstanceOf(FindOperator);
    expect((startedAt as FindOperator<Date>).type).toBe('moreThanOrEqual');
    expect(Object.keys(startedAt as object)).not.toContain('$gte');
  });
});

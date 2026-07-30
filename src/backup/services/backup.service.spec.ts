import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BackupService } from './backup.service';
import { BackupLog } from '../entities/backup-log.entity';

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

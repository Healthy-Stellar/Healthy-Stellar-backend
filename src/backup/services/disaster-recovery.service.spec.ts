import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DisasterRecoveryService } from './disaster-recovery.service';
import { BackupLog, BackupStatus, BackupType } from '../entities/backup-log.entity';
import { RecoveryTest, RecoveryTestStatus } from '../entities/recovery-test.entity';
import { Repository } from 'typeorm';

describe('DisasterRecoveryService', () => {
  let service: DisasterRecoveryService;
  let backupLogRepository: Repository<BackupLog>;
  let recoveryTestRepository: Repository<RecoveryTest>;

  const mockBackupLogRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };

  const mockRecoveryTestRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisasterRecoveryService,
        {
          provide: getRepositoryToken(BackupLog),
          useValue: mockBackupLogRepository,
        },
        {
          provide: getRepositoryToken(RecoveryTest),
          useValue: mockRecoveryTestRepository,
        },
      ],
    }).compile();

    service = module.get<DisasterRecoveryService>(DisasterRecoveryService);
    backupLogRepository = module.get<Repository<BackupLog>>(getRepositoryToken(BackupLog));
    recoveryTestRepository = module.get<Repository<RecoveryTest>>(getRepositoryToken(RecoveryTest));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scheduledRestoreDrill', () => {
    it('should skip if no verified full backup is found', async () => {
      mockBackupLogRepository.findOne.mockResolvedValue(null);
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      await service.scheduledRestoreDrill();

      expect(mockBackupLogRepository.findOne).toHaveBeenCalledWith({
        where: { status: BackupStatus.VERIFIED, backupType: BackupType.FULL },
        order: { completedAt: 'DESC' },
      });
      expect(loggerSpy).toHaveBeenCalledWith('No verified full backup found for automated restore drill');
    });

    it('should perform recovery if verified full backup is found', async () => {
      const mockBackup = { id: 'backup-123', status: BackupStatus.VERIFIED, backupPath: 'path/to/backup' };
      mockBackupLogRepository.findOne.mockResolvedValue(mockBackup);
      
      const performRecoverySpy = jest.spyOn(service, 'performRecovery').mockResolvedValue({} as any);

      await service.scheduledRestoreDrill();

      expect(performRecoverySpy).toHaveBeenCalledWith(
        { backupId: 'backup-123', validateOnly: true },
        'automated-drill',
      );
    });

    it('should log error if recovery fails', async () => {
      const mockBackup = { id: 'backup-123', status: BackupStatus.VERIFIED, backupPath: 'path/to/backup' };
      mockBackupLogRepository.findOne.mockResolvedValue(mockBackup);
      
      const error = new Error('Restore failed');
      jest.spyOn(service, 'performRecovery').mockRejectedValue(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await service.scheduledRestoreDrill();

      expect(loggerSpy).toHaveBeenCalledWith(
        `Automated restore drill for backup backup-123 failed: ${error.message}`,
      );
    });
  });
});

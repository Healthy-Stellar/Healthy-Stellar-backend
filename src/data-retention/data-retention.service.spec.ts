import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataRetentionService } from './data-retention.service';
import { Record } from '../records/entities/record.entity';
import { AuditLogService } from '../common/audit/audit-log.service';
import { RecordType } from '../records/dto/create-record.dto';

const makeRecord = (id: string, createdAt: Date): Record =>
  ({ id, patientId: `patient-${id}`, cid: `cid-${id}`, createdAt } as Record);

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let recordRepo: { find: jest.Mock; save: jest.Mock };
  let auditLogService: { log: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    recordRepo = { find: jest.fn(), save: jest.fn() };
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) };
    configService = { get: jest.fn().mockReturnValue(7) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        { provide: getRepositoryToken(Record), useValue: recordRepo },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(DataRetentionService);
  });

  describe('getRetentionCutoff', () => {
    it('returns a date 7 years in the past by default', () => {
      const cutoff = service.getRetentionCutoff();
      const expectedYear = new Date().getFullYear() - 7;
      expect(cutoff.getFullYear()).toBe(expectedYear);
    });

    it('respects RECORD_RETENTION_YEARS env override', () => {
      configService.get.mockReturnValue(10);
      const cutoff = service.getRetentionCutoff();
      expect(cutoff.getFullYear()).toBe(new Date().getFullYear() - 10);
    });
  });

  describe('enforceRetentionPolicy', () => {
    it('returns early with zero counts when no expired records', async () => {
      recordRepo.find.mockResolvedValue([]);
      const result = await service.enforceRetentionPolicy();
      expect(result).toEqual({ anonymized: 0, errors: 0 });
      expect(recordRepo.save).not.toHaveBeenCalled();
      expect(auditLogService.log).not.toHaveBeenCalled();
    });

    it('anonymizes patientId and clears CID for expired records', async () => {
      const old = makeRecord('abc', new Date('2010-01-01'));
      recordRepo.find.mockResolvedValue([old]);
      recordRepo.save.mockResolvedValue(old);

      await service.enforceRetentionPolicy();

      expect(old.patientId).toBe('ANONYMIZED_abc');
      expect(old.cid).toBe('');
      expect(recordRepo.save).toHaveBeenCalledWith(old);
    });

    it('logs a DATA_RETENTION_ANONYMIZED audit entry per record', async () => {
      const old = makeRecord('xyz', new Date('2010-01-01'));
      recordRepo.find.mockResolvedValue([old]);
      recordRepo.save.mockResolvedValue(old);

      await service.enforceRetentionPolicy();

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DATA_RETENTION_ANONYMIZED',
          entity: 'Record',
          entityId: 'xyz',
          severity: 'LOW',
        }),
      );
    });

    it('counts errors without throwing when save fails', async () => {
      const old = makeRecord('fail', new Date('2010-01-01'));
      recordRepo.find.mockResolvedValue([old]);
      recordRepo.save.mockRejectedValue(new Error('DB error'));

      const result = await service.enforceRetentionPolicy();

      expect(result.errors).toBe(1);
      expect(result.anonymized).toBe(0);
    });

    it('returns correct counts for mixed success/failure', async () => {
      const good = makeRecord('good', new Date('2010-01-01'));
      const bad = makeRecord('bad', new Date('2010-01-01'));
      recordRepo.find.mockResolvedValue([good, bad]);
      recordRepo.save
        .mockResolvedValueOnce(good)
        .mockRejectedValueOnce(new Error('fail'));

      const result = await service.enforceRetentionPolicy();

      expect(result.anonymized).toBe(1);
      expect(result.errors).toBe(1);
    });
  });
});

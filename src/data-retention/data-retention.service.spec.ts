import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataRetentionService } from './data-retention.service';
import { Record } from '../records/entities/record.entity';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AuditLogEntity } from '../common/audit/audit-log.entity';

const makeRecord = (id: string, createdAt: Date): Record =>
  ({ id, patientId: `patient-${id}`, cid: `cid-${id}`, createdAt }) as Record;

const makeAuditLog = (id: string, createdAt: Date): AuditLogEntity =>
  ({ id, createdAt }) as AuditLogEntity;

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let recordRepo: { find: jest.Mock; save: jest.Mock; softDelete: jest.Mock };
  let auditLogRepo: { find: jest.Mock; softDelete: jest.Mock };
  let auditLogService: { log: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    recordRepo = { find: jest.fn(), save: jest.fn(), softDelete: jest.fn() };
    auditLogRepo = { find: jest.fn().mockResolvedValue([]), softDelete: jest.fn() };
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) };
    configService = { get: jest.fn().mockReturnValue(7) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        { provide: getRepositoryToken(Record), useValue: recordRepo },
        { provide: getRepositoryToken(AuditLogEntity), useValue: auditLogRepo },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(DataRetentionService);
  });

  describe('getRetentionCutoff', () => {
    it('returns a date 7 years in the past by default', () => {
      const cutoff = service.getRetentionCutoff();
      expect(cutoff.getFullYear()).toBe(new Date().getFullYear() - 7);
    });

    it('respects RECORD_RETENTION_YEARS env override', () => {
      configService.get.mockReturnValue(10);
      expect(service.getRetentionCutoff().getFullYear()).toBe(new Date().getFullYear() - 10);
    });
  });

  describe('getEffectivePolicy', () => {
    it('returns global default when no tenant policy registered', () => {
      const policy = service.getEffectivePolicy(null, 'medical_records');
      expect(policy.retentionYears).toBe(7);
      expect(policy.action).toBe('anonymize');
    });

    it('returns tenant-specific policy when registered', () => {
      service.setTenantPolicy({
        tenantId: 'eu-tenant',
        categories: { medical_records: { retentionYears: 10, action: 'soft_delete' } },
      });
      const policy = service.getEffectivePolicy('eu-tenant', 'medical_records');
      expect(policy.retentionYears).toBe(10);
      expect(policy.action).toBe('soft_delete');
    });

    it('falls back to global for categories not defined in tenant policy', () => {
      service.setTenantPolicy({
        tenantId: 'partial-tenant',
        categories: { audit_logs: { retentionYears: 3, action: 'soft_delete' } },
      });
      const policy = service.getEffectivePolicy('partial-tenant', 'medical_records');
      expect(policy.retentionYears).toBe(7); // global default
    });
  });

  describe('enforceRetentionPolicy (dryRun=false)', () => {
    it('returns early with zero counts when no expired records', async () => {
      recordRepo.find.mockResolvedValue([]);
      const result = await service.enforceRetentionPolicy(false);
      expect(result.processed).toBe(0);
      expect(result.errors).toBe(0);
      expect(recordRepo.save).not.toHaveBeenCalled();
    });

    it('anonymizes records past retention date and logs audit entry', async () => {
      const old = makeRecord('abc', new Date('2010-01-01'));
      recordRepo.find.mockResolvedValue([old]);
      recordRepo.save.mockImplementation((r) => Promise.resolve(r));

      const result = await service.enforceRetentionPolicy(false);

      expect(old.patientId).toBe('ANONYMIZED_abc');
      expect(old.cid).toBe('');
      expect(recordRepo.save).toHaveBeenCalledWith(old);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DATA_RETENTION_PURGED', entity: 'Record', entityId: 'abc' }),
      );
      expect(result.processed).toBe(1);
    });

    it('counts errors without throwing when save fails', async () => {
      const old = makeRecord('fail', new Date('2010-01-01'));
      recordRepo.find.mockResolvedValue([old]);
      recordRepo.save.mockRejectedValue(new Error('DB error'));

      const result = await service.enforceRetentionPolicy(false);
      expect(result.errors).toBe(1);
      expect(result.processed).toBe(0);
    });
  });

  describe('enforceRetentionPolicy (dryRun=true)', () => {
    it('reports what would be purged without deleting', async () => {
      const old = makeRecord('dry-1', new Date('2010-01-01'));
      recordRepo.find.mockResolvedValue([old]);

      const result = await service.enforceRetentionPolicy(true);

      expect(result.dryRun).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.details[0]).toMatchObject({ id: 'dry-1', category: 'medical_records' });
      // Nothing actually deleted or saved
      expect(recordRepo.save).not.toHaveBeenCalled();
      expect(recordRepo.softDelete).not.toHaveBeenCalled();
      expect(auditLogService.log).not.toHaveBeenCalled();
    });
  });

  describe('per-tenant policy — EU 10-year rule', () => {
    it('uses tenant-specific 10-year retention for EU tenant', () => {
      service.setTenantPolicy({
        tenantId: 'eu-tenant',
        categories: { medical_records: { retentionYears: 10, action: 'anonymize' } },
      });
      const cutoff = service.getCutoff(
        service.getEffectivePolicy('eu-tenant', 'medical_records'),
      );
      expect(cutoff.getFullYear()).toBe(new Date().getFullYear() - 10);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RetentionEnforcementJob } from './retention-enforcement.job';
import { Record as MedicalRecord } from '../../records/entities/record.entity';
import { AuditLogEntity } from '../../common/audit/audit-log.entity';
import { EventStoreService } from '../../event-store/event-store.service';
import { ArchiveService } from '../services/archive.service';
import { RetentionPolicyRegistryService } from '../services/retention-policy-registry.service';

const makeRecord = (id: string, createdAt: Date) =>
  ({ id, patientId: `patient-${id}`, cid: `cid-${id}`, createdAt }) as MedicalRecord;

const makeAuditLog = (id: string, createdAt: Date) =>
  ({ id, action: 'DATA_ACCESS', entity: 'Record', createdAt }) as AuditLogEntity;

describe('RetentionEnforcementJob', () => {
  let job: RetentionEnforcementJob;
  let recordRepo: { find: jest.Mock; delete: jest.Mock };
  let auditLogRepo: { find: jest.Mock; delete: jest.Mock };
  let archiveService: { archiveBatch: jest.Mock };
  let eventStore: { append: jest.Mock };
  let policyRegistry: RetentionPolicyRegistryService;

  beforeEach(async () => {
    recordRepo = { find: jest.fn().mockResolvedValue([]), delete: jest.fn() };
    auditLogRepo = { find: jest.fn().mockResolvedValue([]), delete: jest.fn() };
    archiveService = { archiveBatch: jest.fn().mockResolvedValue(0) };
    eventStore = { append: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionEnforcementJob,
        RetentionPolicyRegistryService,
        { provide: getRepositoryToken(MedicalRecord), useValue: recordRepo },
        { provide: getRepositoryToken(AuditLogEntity), useValue: auditLogRepo },
        { provide: ArchiveService, useValue: archiveService },
        { provide: EventStoreService, useValue: eventStore },
      ],
    }).compile();

    job = module.get(RetentionEnforcementJob);
    policyRegistry = module.get(RetentionPolicyRegistryService);
  });

  describe('dry-run mode', () => {
    it('reports expired records without archiving, deleting, or emitting events', async () => {
      const expired = [makeRecord('rec-1', new Date('2010-01-01'))];
      recordRepo.find.mockResolvedValueOnce(expired).mockResolvedValue([]);

      const report = await job.runDryRun();

      expect(report.dryRun).toBe(true);
      expect(report.totalRecords).toBe(1);
      expect(report.totalArchived).toBe(0);
      expect(report.totalDeleted).toBe(0);

      expect(archiveService.archiveBatch).not.toHaveBeenCalled();
      expect(recordRepo.delete).not.toHaveBeenCalled();
      expect(eventStore.append).not.toHaveBeenCalled();
    });

    it('returns zero counts when nothing is expired', async () => {
      const report = await job.runDryRun();

      expect(report.totalRecords).toBe(0);
      expect(report.batches).toHaveLength(0);
      expect(eventStore.append).not.toHaveBeenCalled();
    });
  });

  describe('runNightly / run(false)', () => {
    it('archives and deletes expired medical_records, then emits a batch event', async () => {
      const expired = [makeRecord('rec-1', new Date('2010-01-01'))];
      recordRepo.find.mockResolvedValueOnce(expired).mockResolvedValue([]);
      recordRepo.delete.mockResolvedValue({ affected: 1 });
      archiveService.archiveBatch.mockResolvedValueOnce(1);

      const report = await job.run(false);

      expect(archiveService.archiveBatch).toHaveBeenCalledWith(
        'medical_records',
        expect.stringContaining('default-medical_records'),
        expect.arrayContaining([expect.objectContaining({ id: 'rec-1' })]),
      );
      expect(recordRepo.delete).toHaveBeenCalledWith(['rec-1']);

      expect(eventStore.append).toHaveBeenCalledTimes(1);
      const [aggregateId, events, expectedVersion] = eventStore.append.mock.calls[0];
      expect(aggregateId).toContain('retention-default-medical_records');
      expect(expectedVersion).toBe(0);
      expect(events[0]).toMatchObject({
        eventType: 'retention.batch_processed',
        payload: expect.objectContaining({
          entityType: 'medical_records',
          recordCount: 1,
          archivedCount: 1,
          deletedCount: 1,
          dryRun: false,
        }),
      });

      expect(report.totalRecords).toBe(1);
      expect(report.totalArchived).toBe(1);
      expect(report.totalDeleted).toBe(1);
    });

    it('emits a separate batch event per entity type processed in the same run', async () => {
      recordRepo.find.mockResolvedValueOnce([makeRecord('rec-1', new Date('2010-01-01'))]).mockResolvedValue([]);
      auditLogRepo.find
        .mockResolvedValueOnce([makeAuditLog('log-1', new Date('2010-01-01'))])
        .mockResolvedValue([]);
      recordRepo.delete.mockResolvedValue({ affected: 1 });
      auditLogRepo.delete.mockResolvedValue({ affected: 1 });
      archiveService.archiveBatch.mockResolvedValue(1);

      await job.run(false);

      expect(eventStore.append).toHaveBeenCalledTimes(2);
      const entityTypesEmitted = eventStore.append.mock.calls.map(
        ([, events]) => events[0].payload.entityType,
      );
      expect(entityTypesEmitted.sort()).toEqual(['audit_logs', 'medical_records']);
    });

    it('continues processing audit_logs even if medical_records processing throws', async () => {
      recordRepo.find.mockRejectedValueOnce(new Error('DB connection lost'));
      auditLogRepo.find.mockResolvedValueOnce([makeAuditLog('log-1', new Date('2010-01-01'))]).mockResolvedValue([]);
      auditLogRepo.delete.mockResolvedValue({ affected: 1 });
      archiveService.archiveBatch.mockResolvedValue(1);

      const report = await job.run(false);

      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].entityType).toBe('medical_records');
      expect(report.totalRecords).toBe(1); // audit_logs still processed
    });
  });

  describe('tenant-override resolution during a run', () => {
    it('does not double-process global rows for tenants with overrides registered (no tenant column wired)', async () => {
      policyRegistry.setTenantOverride({
        tenantId: 'eu-tenant',
        policies: { medical_records: { retentionDays: 10 * 365 } },
      });

      const expired = [makeRecord('rec-1', new Date('2010-01-01'))];
      recordRepo.find.mockResolvedValueOnce(expired).mockResolvedValue([]);
      recordRepo.delete.mockResolvedValue({ affected: 1 });
      archiveService.archiveBatch.mockResolvedValueOnce(1);

      const report = await job.run(false);

      // Only the global (tenantId=null) pass should produce a batch outcome;
      // the tenant pass is skipped since Record has no tenantId column.
      const tenantBatches = report.batches.filter((b) => b.tenantId === 'eu-tenant');
      expect(tenantBatches).toHaveLength(0);
      expect(report.batches.filter((b) => b.tenantId === null)).toHaveLength(1);
    });
  });
});

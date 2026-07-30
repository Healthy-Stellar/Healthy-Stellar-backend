import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConsentRevocationService } from './consent-revocation.service';
import { ExportConsentMapping, ExportBatchStatus } from '../entities/export-consent-mapping.entity';
import { AccessGrant, GrantStatus } from '../../access-control/entities/access-grant.entity';
import { AuditLogService } from '../../common/services/audit-log.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data: any) => data),
  save: jest.fn(),
});
const mockAudit = () => ({ create: jest.fn().mockResolvedValue(undefined) });
const mockEmitter = () => ({ emit: jest.fn() });

describe('ConsentRevocationService', () => {
  let service: ConsentRevocationService;
  let mappingRepo: ReturnType<typeof mockRepo>;
  let grantRepo: ReturnType<typeof mockRepo>;
  let auditLogService: ReturnType<typeof mockAudit>;
  let eventEmitter: ReturnType<typeof mockEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentRevocationService,
        { provide: getRepositoryToken(ExportConsentMapping), useFactory: mockRepo },
        { provide: getRepositoryToken(AccessGrant), useFactory: mockRepo },
        { provide: AuditLogService, useFactory: mockAudit },
        { provide: EventEmitter2, useFactory: mockEmitter },
      ],
    }).compile();

    service = module.get(ConsentRevocationService);
    mappingRepo = module.get(getRepositoryToken(ExportConsentMapping));
    grantRepo = module.get(getRepositoryToken(AccessGrant));
    auditLogService = module.get(AuditLogService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => jest.clearAllMocks());

  // ── revokePatientConsent ───────────────────────────────────────────────────

  describe('revokePatientConsent', () => {
    it('flags all active export batches containing the revoked patient\'s data', async () => {
      const activeMappings = [
        { id: 'm1', exportId: 'exp-1', patientId: 'patient-1', status: ExportBatchStatus.ACTIVE },
        { id: 'm2', exportId: 'exp-2', patientId: 'patient-1', status: ExportBatchStatus.ACTIVE },
      ];
      mappingRepo.find.mockResolvedValue(activeMappings);
      mappingRepo.save.mockResolvedValue(activeMappings);

      const count = await service.revokePatientConsent('patient-1', 'admin-1');

      expect(count).toBe(2);
      expect(mappingRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            status: ExportBatchStatus.FLAGGED,
            flagReason: 'patient_request',
          }),
        ]),
      );
    });

    it('emits a research.export.revoked event for each distinct export batch', async () => {
      const activeMappings = [
        { id: 'm1', exportId: 'exp-1', patientId: 'patient-1', status: ExportBatchStatus.ACTIVE },
        { id: 'm2', exportId: 'exp-1', patientId: 'patient-1', status: ExportBatchStatus.ACTIVE },
        { id: 'm3', exportId: 'exp-2', patientId: 'patient-1', status: ExportBatchStatus.ACTIVE },
      ];
      mappingRepo.find.mockResolvedValue(activeMappings);
      mappingRepo.save.mockResolvedValue(activeMappings);

      await service.revokePatientConsent('patient-1', 'admin-1');

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'research.export.revoked',
        expect.objectContaining({ exportId: 'exp-1', patientId: 'patient-1' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'research.export.revoked',
        expect.objectContaining({ exportId: 'exp-2' }),
      );
    });

    it('returns 0 and does not persist when no active batches exist for the patient', async () => {
      mappingRepo.find.mockResolvedValue([]);

      const count = await service.revokePatientConsent('unknown-patient', 'admin-1');

      expect(count).toBe(0);
      expect(mappingRepo.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('records an audit log entry for each affected export', async () => {
      const activeMappings = [
        { id: 'm1', exportId: 'exp-1', patientId: 'patient-1', status: ExportBatchStatus.ACTIVE },
      ];
      mappingRepo.find.mockResolvedValue(activeMappings);
      mappingRepo.save.mockResolvedValue(activeMappings);

      await service.revokePatientConsent('patient-1', 'admin-1');

      expect(auditLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'CONSENT_REVOCATION_FLAGGED',
          entityId: 'exp-1',
          userId: 'admin-1',
        }),
      );
    });
  });

  // ── checkExpiredConsents (scheduled job) ────────────────────────────────────

  describe('checkExpiredConsents', () => {
    it('flags export batches for patients with expired grants and marks grants as revoked', async () => {
      const expiredGrant = {
        id: 'grant-1',
        granteeId: 'patient-2',
        expiresAt: new Date('2020-01-01'),
        status: GrantStatus.ACTIVE,
      };
      grantRepo.find.mockResolvedValue([expiredGrant]);
      mappingRepo.find.mockResolvedValue([]);
      grantRepo.save.mockResolvedValue({ ...expiredGrant, status: GrantStatus.REVOKED });

      await service.checkExpiredConsents();

      expect(grantRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: GrantStatus.REVOKED }),
      );
    });

    it('does nothing when there are no expired grants', async () => {
      grantRepo.find.mockResolvedValue([]);

      await service.checkExpiredConsents();

      expect(grantRepo.save).not.toHaveBeenCalled();
      expect(mappingRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── trackExportBatch ───────────────────────────────────────────────────────

  describe('trackExportBatch', () => {
    it('persists one mapping row per patient in the export batch', async () => {
      mappingRepo.save.mockResolvedValue([]);

      await service.trackExportBatch('exp-10', ['p1', 'p2', 'p3'], 'tenant-1', 'researcher-1');

      expect(mappingRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ exportId: 'exp-10', patientId: 'p1' }),
          expect.objectContaining({ exportId: 'exp-10', patientId: 'p2' }),
          expect.objectContaining({ exportId: 'exp-10', patientId: 'p3' }),
        ]),
      );
    });

    it('does nothing when patient list is empty', async () => {
      await service.trackExportBatch('exp-11', [], 'tenant-1', 'researcher-1');
      expect(mappingRepo.save).not.toHaveBeenCalled();
    });
  });
});

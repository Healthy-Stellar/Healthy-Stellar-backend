import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalAuditLog } from '../entities/medical-audit-log.entity';
import { AuditAction, MedicalDepartment } from '../enums/medical-roles.enum';
import { AuditLogEntry } from '../interfaces/medical-rbac.interface';
import { MedicalAuditService } from '../services/medical-audit.service';

const mockAuditRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
});

const sampleEntry = (): AuditLogEntry => ({
  userId: 'user-1',
  staffId: 'STAFF-001',
  action: AuditAction.READ,
  resource: 'patient_records',
  resourceId: 'patient-1',
  patientId: 'patient-1',
  department: MedicalDepartment.GENERAL,
  isEmergencyOverride: false,
  ipAddress: '127.0.0.1',
  success: true,
  timestamp: new Date(),
});

describe('MedicalAuditService', () => {
  let service: MedicalAuditService;
  let repo: jest.Mocked<Repository<MedicalAuditLog>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalAuditService,
        {
          provide: getRepositoryToken(MedicalAuditLog),
          useFactory: mockAuditRepo,
        },
      ],
    }).compile();

    service = module.get(MedicalAuditService);
    repo = module.get(getRepositoryToken(MedicalAuditLog));
  });

  describe('log', () => {
    it('creates and saves an audit log entry', async () => {
      const entry = sampleEntry();
      const created = { id: 'log-1', ...entry };

      repo.create.mockReturnValue(created as any);
      repo.save.mockResolvedValue(created as any);

      const result = await service.log(entry);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: entry.userId,
          staffId: entry.staffId,
          action: entry.action,
          resource: entry.resource,
          isEmergencyOverride: false,
          success: true,
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });

    it('saves emergency override entries with correct flag', async () => {
      const entry = { ...sampleEntry(), isEmergencyOverride: true };
      const created = { id: 'log-2', ...entry };

      repo.create.mockReturnValue(created as any);
      repo.save.mockResolvedValue(created as any);

      const result = await service.log(entry);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isEmergencyOverride: true }),
      );
      expect(result.isEmergencyOverride).toBe(true);
    });

    it('propagates repository errors', async () => {
      const entry = sampleEntry();
      repo.create.mockReturnValue(entry as any);
      repo.save.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.log(entry)).rejects.toThrow('DB connection lost');
    });
  });

  describe('logAccessDenied', () => {
    it('logs a PERMISSION_DENIED entry with success=false', async () => {
      const log = { id: 'log-3' } as MedicalAuditLog;
      repo.create.mockReturnValue(log);
      repo.save.mockResolvedValue(log);

      await service.logAccessDenied('user-1', 'STAFF-001', 'patient_records', 'No role');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PERMISSION_DENIED',
          success: false,
          failureReason: 'No role',
        }),
      );
    });
  });

  describe('queryLogs', () => {
    it('queries with userId filter', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.queryLogs({ userId: 'user-1', page: 1, limit: 10 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('applies emergency-only filter', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.queryLogs({ emergencyOnly: true });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isEmergencyOverride: true }),
        }),
      );
    });

    it('caps limit at 100', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.queryLogs({ limit: 9999 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('returns pagination result', async () => {
      const logs = [{ id: 'log-1' } as MedicalAuditLog];
      repo.findAndCount.mockResolvedValue([logs, 1]);

      const result = await service.queryLogs({});
      expect(result).toEqual({ data: logs, total: 1 });
    });
  });

  describe('getEmergencyOverrideLogs', () => {
    it('fetches only emergency override entries', async () => {
      repo.find.mockResolvedValue([]);

      await service.getEmergencyOverrideLogs();

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isEmergencyOverride: true },
        }),
      );
    });
  });

  describe('getPatientAccessHistory', () => {
    it('fetches audit logs for the given patient', async () => {
      repo.find.mockResolvedValue([]);

      await service.getPatientAccessHistory('patient-abc');

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: 'patient-abc' },
        }),
      );
    });
  });
});

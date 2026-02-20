import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit.service';
import { AuditLog, AuditAction, AuditSeverity } from '../../entities/audit-log.entity';
import { EncryptionService } from '../../encryption/encryption.service';

const mockAuditLogRepository = () => ({
  save: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockEncryptionService = {
  hashIdentifier: jest.fn((val: string) => `hashed:${val}`),
  createIntegritySignature: jest.fn(() => 'mock-integrity-hash'),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

describe('AuditService', () => {
  let service: AuditService;
  let repo: jest.Mocked<Repository<AuditLog>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useFactory: mockAuditLogRepository },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repo = module.get(getRepositoryToken(AuditLog));
    eventEmitter = module.get(EventEmitter2);

    // Reset mocks
    jest.clearAllMocks();
    repo.save.mockResolvedValue({} as AuditLog);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('log', () => {
    it('should emit audit.logged event for all logs', async () => {
      await service.log({
        action: AuditAction.PHI_ACCESS,
        resource: '/patients/123',
        userId: 'user-1',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('audit.logged', expect.any(Object));
    });

    it('should immediately persist CRITICAL severity logs', async () => {
      await service.log({
        action: AuditAction.SECURITY_VIOLATION,
        severity: AuditSeverity.CRITICAL,
        resource: '/admin',
        userId: 'user-1',
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should immediately persist EMERGENCY severity logs', async () => {
      await service.log({
        action: AuditAction.BREACH_REPORTED,
        severity: AuditSeverity.EMERGENCY,
        resource: '/incident',
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should buffer non-critical logs', async () => {
      await service.log({
        action: AuditAction.PHI_ACCESS,
        resource: '/patients',
        userId: 'user-1',
      });

      // Non-critical should be buffered, not immediately saved
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should hash patient ID before storing', async () => {
      await service.log({
        action: AuditAction.PHI_ACCESS,
        resource: '/patients/123',
        patientId: 'patient-999',
        severity: AuditSeverity.CRITICAL,
      });

      expect(mockEncryptionService.hashIdentifier).toHaveBeenCalledWith('patient-999');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ patientIdHash: 'hashed:patient-999' }),
      );
    });

    it('should include integrity hash in all audit entries', async () => {
      await service.log({
        action: AuditAction.LOGIN_SUCCESS,
        resource: '/auth/login',
        severity: AuditSeverity.CRITICAL,
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ integrityHash: 'mock-integrity-hash' }),
      );
    });

    it('should flush buffer when it reaches size threshold', async () => {
      // Log 50 non-critical entries (buffer size)
      const logs = Array.from({ length: 50 }, (_, i) =>
        service.log({
          action: AuditAction.PHI_ACCESS,
          resource: `/patients/${i}`,
          userId: 'user-1',
        })
      );

      await Promise.all(logs);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('logPhiAccess', () => {
    it('should log PHI access with correct action', async () => {
      const logSpy = jest.spyOn(service, 'log');
      await service.logPhiAccess('user-1', 'patient-1', '/patients/1', AuditAction.PHI_ACCESS);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          patientId: 'patient-1',
          resource: '/patients/1',
          action: AuditAction.PHI_ACCESS,
        }),
      );
    });
  });

  describe('logSecurityViolation', () => {
    it('should log with CRITICAL severity and emit security.violation event', async () => {
      await service.logSecurityViolation(
        { resource: '/admin', userId: 'user-1', ipAddress: '1.2.3.4' },
        'SQL injection attempt',
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'security.violation',
        expect.objectContaining({ reason: 'SQL injection attempt' }),
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SECURITY_VIOLATION,
          severity: AuditSeverity.CRITICAL,
        }),
      );
    });
  });

  describe('query', () => {
    it('should query with user ID filter', async () => {
      repo.findAndCount.mockResolvedValue([[{} as AuditLog], 1]);

      const result = await service.query({ userId: 'user-1' });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
      );
      expect(result.total).toBe(1);
    });

    it('should hash patient ID for query', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.query({ patientId: 'patient-123' });

      expect(mockEncryptionService.hashIdentifier).toHaveBeenCalledWith('patient-123');
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ patientIdHash: 'hashed:patient-123' }),
        }),
      );
    });

    it('should apply date range filter when both dates provided', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');

      await service.query({ startDate: start, endDate: end });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdAt: Between(start, end) }),
        }),
      );
    });

    it('should apply pagination', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.query({ limit: 25, offset: 50 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25, skip: 50 }),
      );
    });
  });

  describe('detectAnomalies', () => {
    it('should return false when under threshold', async () => {
      repo.count.mockResolvedValue(50);

      const result = await service.detectAnomalies('user-1');

      expect(result).toBe(false);
      expect(eventEmitter.emit).not.toHaveBeenCalledWith('audit.anomaly', expect.anything());
    });

    it('should return true and emit event when over threshold', async () => {
      repo.count.mockResolvedValue(150);

      const result = await service.detectAnomalies('user-1');

      expect(result).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'audit.anomaly',
        expect.objectContaining({ userId: 'user-1', count: 150 }),
      );
    });
  });

  describe('generateActivityReport', () => {
    it('should return a structured activity report', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { action: 'PHI_ACCESS', count: '100', severity: 'INFO' },
        ]),
      };
      repo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      repo.count.mockResolvedValue(5);

      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      const report = await service.generateActivityReport(start, end);

      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('violations');
      expect(report).toHaveProperty('anomalies');
      expect(report).toHaveProperty('generatedAt');
    });
  });
});

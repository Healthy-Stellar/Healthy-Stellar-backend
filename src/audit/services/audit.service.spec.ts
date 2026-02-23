import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditAction, ResourceType } from '../dto/audit-event.dto';

describe('AuditService', () => {
  let service: AuditService;
  let repository: Repository<AuditLog>;
  let eventEmitter: EventEmitter2;

  const mockRepository = {
    save: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('log', () => {
    it('should log an audit event', async () => {
      const event = {
        actorId: 'user-123',
        action: AuditAction.RECORD_READ,
        resourceId: 'record-456',
        resourceType: ResourceType.RECORD,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      await service.log(event);

      expect(eventEmitter.emit).toHaveBeenCalledWith('audit.logged', expect.objectContaining({
        actorId: event.actorId,
        action: event.action,
        resourceId: event.resourceId,
      }));
    });

    it('should buffer logs and not save immediately', async () => {
      const event = {
        actorId: 'user-123',
        action: AuditAction.RECORD_READ,
        resourceId: 'record-456',
        resourceType: ResourceType.RECORD,
      };

      await service.log(event);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should flush buffer when full', async () => {
      mockRepository.save.mockResolvedValue([]);

      // Log 100 events to fill the buffer
      for (let i = 0; i < 100; i++) {
        await service.log({
          actorId: `user-${i}`,
          action: AuditAction.RECORD_READ,
          resourceId: `record-${i}`,
          resourceType: ResourceType.RECORD,
        });
      }

      expect(repository.save).toHaveBeenCalled();
    });

    it('should create integrity hash for each log', async () => {
      const event = {
        actorId: 'user-123',
        action: AuditAction.RECORD_READ,
        resourceId: 'record-456',
        resourceType: ResourceType.RECORD,
      };

      await service.log(event);

      // Trigger flush
      await service['flushBuffer']();

      expect(repository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            integrityHash: expect.any(String),
          }),
        ]),
      );
    });
  });

  describe('logRecordAccess', () => {
    it('should log record access with patient ID in metadata', async () => {
      const spy = jest.spyOn(service, 'log');

      await service.logRecordAccess(
        'user-123',
        AuditAction.RECORD_READ,
        'record-456',
        'patient-789',
        { fileName: 'test.pdf' },
      );

      expect(spy).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: AuditAction.RECORD_READ,
        resourceId: 'record-456',
        resourceType: ResourceType.RECORD,
        metadata: {
          fileName: 'test.pdf',
          patientId: 'patient-789',
        },
      });
    });
  });

  describe('query', () => {
    it('should allow admin to query all logs', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.query(
        { page: 1, limit: 50 },
        'admin-123',
        'ADMIN',
      );

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      });
    });

    it('should allow patient to query their own logs', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.query(
        { patientId: 'patient-123', page: 1, limit: 50 },
        'patient-123',
        'PATIENT',
      );

      expect(result).toBeDefined();
    });

    it('should prevent patient from querying other patient logs', async () => {
      await expect(
        service.query(
          { patientId: 'patient-456', page: 1, limit: 50 },
          'patient-123',
          'PATIENT',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent non-admin/non-patient from querying logs', async () => {
      await expect(
        service.query(
          { page: 1, limit: 50 },
          'user-123',
          'DOCTOR',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should filter by date range', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.query(
        {
          fromDate: '2024-01-01T00:00:00Z',
          toDate: '2024-12-31T23:59:59Z',
          page: 1,
          limit: 50,
        },
        'admin-123',
        'ADMIN',
      );

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object),
          }),
        }),
      );
    });

    it('should paginate results correctly', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 150]);

      const result = await service.query(
        { page: 2, limit: 50 },
        'admin-123',
        'ADMIN',
      );

      expect(result.totalPages).toBe(3);
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50,
          take: 50,
        }),
      );
    });
  });

  describe('exportToCsv', () => {
    it('should export logs as CSV', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          actorId: 'user-123',
          action: AuditAction.RECORD_READ,
          resourceType: ResourceType.RECORD,
          resourceId: 'record-456',
          patientId: 'patient-789',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          stellarTxHash: null,
          createdAt: new Date('2024-01-15T10:30:00Z'),
          metadata: { test: 'data' },
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockLogs, 1]);

      const csv = await service.exportToCsv(
        { page: 1, limit: 50 },
        'admin-123',
        'ADMIN',
      );

      expect(csv).toContain('ID,Actor ID,Action');
      expect(csv).toContain('log-1');
      expect(csv).toContain('user-123');
      expect(csv).toContain('RECORD_READ');
    });

    it('should escape CSV special characters', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          actorId: 'user-123',
          action: AuditAction.RECORD_READ,
          resourceType: ResourceType.RECORD,
          resourceId: 'record-456',
          patientId: null,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 "Special"',
          stellarTxHash: null,
          createdAt: new Date('2024-01-15T10:30:00Z'),
          metadata: null,
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockLogs, 1]);

      const csv = await service.exportToCsv(
        { page: 1, limit: 50 },
        'admin-123',
        'ADMIN',
      );

      expect(csv).toContain('""Special""');
    });

    it('should log the export action', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);
      const spy = jest.spyOn(service, 'log');

      await service.exportToCsv(
        { page: 1, limit: 50 },
        'admin-123',
        'ADMIN',
      );

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RECORD_EXPORT,
          resourceType: ResourceType.SYSTEM,
        }),
      );
    });
  });

  describe('getPatientAuditStats', () => {
    it('should return patient audit statistics', async () => {
      const mockStats = [
        { action: 'RECORD_READ', count: '10' },
        { action: 'RECORD_WRITE', count: '5' },
      ];

      const mockRecentAccesses = [
        {
          id: 'log-1',
          actorId: 'user-123',
          action: AuditAction.RECORD_READ,
          createdAt: new Date(),
        },
      ];

      mockRepository.createQueryBuilder = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
      });

      mockRepository.count.mockResolvedValue(15);
      mockRepository.find.mockResolvedValue(mockRecentAccesses);

      const stats = await service.getPatientAuditStats('patient-123');

      expect(stats).toEqual({
        patientId: 'patient-123',
        totalAccesses: 15,
        actionBreakdown: mockStats,
        recentAccesses: mockRecentAccesses,
      });
    });
  });

  describe('verifyIntegrity', () => {
    it('should verify integrity of audit log', () => {
      const log = {
        id: 'log-1',
        actorId: 'user-123',
        action: AuditAction.RECORD_READ,
        resourceId: 'record-456',
        resourceType: ResourceType.RECORD,
        createdAt: new Date('2024-01-15T10:30:00Z'),
        integrityHash: '',
      } as AuditLog;

      // Calculate the correct hash
      const dataString = JSON.stringify({
        actorId: log.actorId,
        action: log.action,
        resourceId: log.resourceId,
        resourceType: log.resourceType,
        timestamp: log.createdAt.toISOString(),
      });

      const crypto = require('crypto');
      log.integrityHash = crypto.createHash('sha256').update(dataString).digest('hex');

      const isValid = service.verifyIntegrity(log);
      expect(isValid).toBe(true);
    });

    it('should detect tampered audit log', () => {
      const log = {
        id: 'log-1',
        actorId: 'user-123',
        action: AuditAction.RECORD_READ,
        resourceId: 'record-456',
        resourceType: ResourceType.RECORD,
        createdAt: new Date('2024-01-15T10:30:00Z'),
        integrityHash: 'invalid-hash',
      } as AuditLog;

      const isValid = service.verifyIntegrity(log);
      expect(isValid).toBe(false);
    });
  });

  describe('anchorToStellar', () => {
    it('should anchor audit log to Stellar', async () => {
      mockRepository.query.mockResolvedValue([]);

      await service.anchorToStellar('log-123', 'stellar-tx-hash-abc');

      expect(repository.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE audit_logs'),
        ['stellar-tx-hash-abc', 'log-123'],
      );
    });
  });
});

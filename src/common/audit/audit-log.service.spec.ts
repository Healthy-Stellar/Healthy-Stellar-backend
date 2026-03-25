import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from '../services/audit-log.service';
import { AuditLog } from '../entities/audit-log.entity';
import { SensitiveAuditLog, SensitiveAuditAction } from '../entities/sensitive-audit-log.entity';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

const mockQueryBuilder = {
  orderBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getCount: jest.fn(),
  getMany: jest.fn(),
};

const mockAuditLogRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockSensitiveRepo = {
  create: jest.fn((data) => ({ ...data })),
  save: jest.fn(async (e) => ({ id: 'uuid-1', ...e })),
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
};

describe('AuditLogService — log() and findAllSensitive()', () => {
  let service: AuditLogService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
        { provide: getRepositoryToken(SensitiveAuditLog), useValue: mockSensitiveRepo },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  describe('log()', () => {
    it('inserts a new sensitive audit record and returns it', async () => {
      const result = await service.log({
        actorAddress: '0xActor',
        action: SensitiveAuditAction.LOGIN,
        ipAddress: '127.0.0.1',
      });

      expect(mockSensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorAddress: '0xActor',
          action: SensitiveAuditAction.LOGIN,
          ipAddress: '127.0.0.1',
          targetAddress: null,
          resourceType: null,
          resourceId: null,
        }),
      );
      expect(mockSensitiveRepo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('uuid-1');
    });

    it('stores targetAddress and resourceType when provided', async () => {
      await service.log({
        actorAddress: '0xDoctor',
        action: SensitiveAuditAction.RECORD_ACCESS,
        targetAddress: '0xPatient',
        resourceType: 'MedicalRecord',
        resourceId: 'res-uuid',
      });

      expect(mockSensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAddress: '0xPatient',
          resourceType: 'MedicalRecord',
          resourceId: 'res-uuid',
        }),
      );
    });

    it('defaults optional fields to null when not provided', async () => {
      await service.log({ actorAddress: '0xAdmin', action: SensitiveAuditAction.ADMIN_OPERATION });

      expect(mockSensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAddress: null,
          resourceType: null,
          resourceId: null,
          ipAddress: null,
        }),
      );
    });

    it('stores metadata when provided', async () => {
      await service.log({
        actorAddress: '0xActor',
        action: SensitiveAuditAction.GRANT_CHANGE,
        metadata: { reason: 'emergency access' },
      });

      expect(mockSensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { reason: 'emergency access' } }),
      );
    });
  });

  describe('findAllSensitive()', () => {
    const sampleRow: Partial<SensitiveAuditLog> = {
      id: 'uuid-1',
      actorAddress: '0xActor',
      action: SensitiveAuditAction.LOGIN,
      timestamp: new Date('2024-01-01T00:00:00Z'),
    };

    beforeEach(() => {
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([sampleRow]);
    });

    it('returns paginated results with defaults', async () => {
      const result = await service.findAllSensitive({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('applies actorAddress filter', async () => {
      const query: QueryAuditLogsDto = { actorAddress: '0xActor' };
      await service.findAllSensitive(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'al.actorAddress = :actorAddress',
        { actorAddress: '0xActor' },
      );
    });

    it('applies action filter', async () => {
      await service.findAllSensitive({ action: SensitiveAuditAction.LOGIN });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'al.action = :action',
        { action: SensitiveAuditAction.LOGIN },
      );
    });

    it('applies date range filters', async () => {
      await service.findAllSensitive({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'al.timestamp >= :startDate',
        expect.objectContaining({ startDate: expect.any(Date) }),
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'al.timestamp <= :endDate',
        expect.objectContaining({ endDate: expect.any(Date) }),
      );
    });

    it('respects custom page and limit', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(50);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.findAllSensitive({ page: 3, limit: 10 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20); // (3-1)*10
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });
  });
});

/**
 * Comprehensive unit tests for AuditLogService — PHI audit methods:
 *  - log()             (sensitive INSERT-only entries)
 *  - findAllSensitive() (paginated query with all filters)
 *
 * PaginationUtil.paginateQueryBuilder is mocked via jest.spyOn so we can
 * control the paginated response without a real DB.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from '../services/audit-log.service';
import { AuditLog } from '../entities/audit-log.entity';
import { SensitiveAuditLog, SensitiveAuditAction } from '../entities/sensitive-audit-log.entity';
import { QueryAuditLogsDto, PhiAuditAction } from './dto/query-audit-logs.dto';
import { PaginationUtil } from '../utils/pagination.util';
import { PaginatedResponseDto, PaginationMetaDto } from '../dto/paginated-response.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page = 1,
  pageSize = 20,
): PaginatedResponseDto<T> {
  const meta: PaginationMetaDto = {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    hasNextPage: page < Math.ceil(total / pageSize),
    hasPrevPage: page > 1,
  };
  return new PaginatedResponseDto(data, meta);
}

// ---------------------------------------------------------------------------
// Query-builder mock — all chainable methods return `this`
// ---------------------------------------------------------------------------
const mockQb = {
  orderBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
  getMany: jest.fn(),
  getCount: jest.fn(),
};

// ---------------------------------------------------------------------------
// Repository mocks
// ---------------------------------------------------------------------------
const mockAuditLogRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockSensitiveRepo = {
  create: jest.fn((data) => ({ ...data })),
  save: jest.fn(async (entity) => ({ id: 'uuid-generated', ...entity })),
  createQueryBuilder: jest.fn(() => mockQb),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe('AuditLogService — PHI audit (log + findAllSensitive)', () => {
  let service: AuditLogService;
  let paginateSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default spy: returns an empty paginated response
    paginateSpy = jest
      .spyOn(PaginationUtil, 'paginateQueryBuilder')
      .mockResolvedValue(buildPaginatedResponse([], 0));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
        { provide: getRepositoryToken(SensitiveAuditLog), useValue: mockSensitiveRepo },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  // -------------------------------------------------------------------------
  // log()
  // -------------------------------------------------------------------------
  describe('log()', () => {
    it('inserts a SensitiveAuditEntry and returns the saved record', async () => {
      const entry = {
        actorAddress: '0xDoctor',
        action: SensitiveAuditAction.RECORD_ACCESS,
        targetAddress: '0xPatient',
        resourceType: 'MedicalRecord',
        resourceId: 'res-uuid-001',
        ipAddress: '192.168.1.1',
        metadata: { note: 'emergency' },
      };

      const result = await service.log(entry);

      // create() called with correct payload
      expect(mockSensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorAddress: '0xDoctor',
          action: SensitiveAuditAction.RECORD_ACCESS,
          targetAddress: '0xPatient',
          resourceType: 'MedicalRecord',
          resourceId: 'res-uuid-001',
          ipAddress: '192.168.1.1',
          metadata: { note: 'emergency' },
        }),
      );

      // save() called once
      expect(mockSensitiveRepo.save).toHaveBeenCalledTimes(1);

      // returned record has the mocked id
      expect(result).toMatchObject({ id: 'uuid-generated', actorAddress: '0xDoctor' });
    });

    it('defaults optional fields to null when not provided', async () => {
      await service.log({
        actorAddress: '0xActor',
        action: SensitiveAuditAction.LOGIN,
      });

      expect(mockSensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAddress: null,
          resourceType: null,
          resourceId: null,
          ipAddress: null,
        }),
      );
    });

    it('persists metadata when supplied', async () => {
      await service.log({
        actorAddress: '0xActor',
        action: SensitiveAuditAction.ADMIN_OPERATION,
        metadata: { reason: 'scheduled maintenance' },
      });

      expect(mockSensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { reason: 'scheduled maintenance' } }),
      );
    });

    it('defaults metadata to empty object when not provided', async () => {
      await service.log({ actorAddress: '0xActor', action: SensitiveAuditAction.LOGIN });

      expect(mockSensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: {} }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findAllSensitive()
  // -------------------------------------------------------------------------
  describe('findAllSensitive()', () => {
    const sampleRow: Partial<SensitiveAuditLog> = {
      id: 'row-uuid',
      actorAddress: '0xActor',
      action: SensitiveAuditAction.RECORD_ACCESS,
      timestamp: new Date('2024-06-15T12:00:00Z'),
    };

    it('returns paginated results with default page/pageSize', async () => {
      paginateSpy.mockResolvedValue(buildPaginatedResponse([sampleRow as SensitiveAuditLog], 1));

      const result = await service.findAllSensitive({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
    });

    it('applies patientId filter as resourceId WHERE clause', async () => {
      const query: QueryAuditLogsDto = { patientId: 'patient-uuid-999' };
      await service.findAllSensitive(query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('al.resourceId = :patientId', {
        patientId: 'patient-uuid-999',
      });
    });

    it('applies actorId filter on actorAddress column', async () => {
      const query: QueryAuditLogsDto = { actorId: 'actor-user-id-123' };
      await service.findAllSensitive(query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('al.actorAddress = :actorId', {
        actorId: 'actor-user-id-123',
      });
    });

    it('applies actionType filter (enum wins over freeform action)', async () => {
      const query: QueryAuditLogsDto = {
        actionType: PhiAuditAction.READ,
        action: 'some-freeform-value',
      };
      await service.findAllSensitive(query);

      // actionType should be applied
      expect(mockQb.andWhere).toHaveBeenCalledWith('al.action = :actionType', {
        actionType: PhiAuditAction.READ,
      });
      // freeform action should NOT be applied when actionType is set
      const andWhereCalls: string[] = mockQb.andWhere.mock.calls.map(
        (c: [string, ...unknown[]]) => c[0],
      );
      expect(andWhereCalls).not.toContain('al.action = :action');
    });

    it('applies freeform action filter when actionType is absent', async () => {
      const query: QueryAuditLogsDto = { action: SensitiveAuditAction.LOGIN };
      await service.findAllSensitive(query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('al.action = :action', {
        action: SensitiveAuditAction.LOGIN,
      });
    });

    it('applies startDate and endDate filters as Date objects', async () => {
      const query: QueryAuditLogsDto = { startDate: '2024-01-01', endDate: '2024-12-31' };
      await service.findAllSensitive(query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('al.timestamp >= :startDate', {
        startDate: new Date('2024-01-01'),
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('al.timestamp <= :endDate', {
        endDate: new Date('2024-12-31'),
      });
    });

    it('respects custom page and pageSize values', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ ...sampleRow, id: `row-${i}` }));
      paginateSpy.mockResolvedValue(
        buildPaginatedResponse(items as SensitiveAuditLog[], 50, 3, 5),
      );

      const query: QueryAuditLogsDto = { page: 3, pageSize: 5 };
      const result = await service.findAllSensitive(query);

      // Verify PaginationUtil was called with the correct pagination options
      expect(paginateSpy).toHaveBeenCalledWith(expect.anything(), { page: 3, pageSize: 5 });

      // Verify the response reflects the custom pagination
      expect(result.meta.page).toBe(3);
      expect(result.meta.pageSize).toBe(5);
      expect(result.data).toHaveLength(5);
    });

    it('does not add WHERE clause for filters that are not provided', async () => {
      await service.findAllSensitive({});

      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });

    it('applies actorAddress filter correctly', async () => {
      const query: QueryAuditLogsDto = { actorAddress: '0xWalletAddress' };
      await service.findAllSensitive(query);

      expect(mockQb.andWhere).toHaveBeenCalledWith('al.actorAddress = :actorAddress', {
        actorAddress: '0xWalletAddress',
      });
    });

    it('orders results by timestamp DESC', async () => {
      await service.findAllSensitive({});

      expect(mockQb.orderBy).toHaveBeenCalledWith('al.timestamp', 'DESC');
    });

    it('calls paginateQueryBuilder with the query builder and pagination options', async () => {
      const query: QueryAuditLogsDto = { page: 2, pageSize: 10 };
      await service.findAllSensitive(query);

      expect(paginateSpy).toHaveBeenCalledWith(
        expect.anything(), // the query builder
        { page: 2, pageSize: 10 },
      );
    });
  });
});

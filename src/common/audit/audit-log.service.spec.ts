import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from '../services/audit-log.service';
import { AuditLog } from '../entities/audit-log.entity';
import { SensitiveAuditLog, SensitiveAuditAction } from '../entities/sensitive-audit-log.entity';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

const makeQueryBuilder = (rows: Partial<SensitiveAuditLog>[] = [], total = 0) => ({
  orderBy: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
});

const makeAuditLogRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const makeSensitiveRepo = (qb: ReturnType<typeof makeQueryBuilder>) => ({
  create: jest.fn((data) => ({ ...data })),
  save: jest.fn(async (e) => ({ id: 'uuid-1', ...e })),
  createQueryBuilder: jest.fn(() => qb),
});

describe('AuditLogService — log() and findAllSensitive()', () => {
  let service: AuditLogService;
  let qb: ReturnType<typeof makeQueryBuilder>;
  let sensitiveRepo: ReturnType<typeof makeSensitiveRepo>;

  const sampleRow: Partial<SensitiveAuditLog> = {
    id: 'uuid-1',
    actorAddress: '0xActor',
    action: SensitiveAuditAction.PHI_READ,
    timestamp: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    qb = makeQueryBuilder([sampleRow], 1);
    sensitiveRepo = makeSensitiveRepo(qb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: makeAuditLogRepo() },
        { provide: getRepositoryToken(SensitiveAuditLog), useValue: sensitiveRepo },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  // ── log() ──────────────────────────────────────────────────────────────────

  describe('log()', () => {
    it('inserts a new sensitive audit record and returns it', async () => {
      const result = await service.log({
        actorAddress: '0xActor',
        action: SensitiveAuditAction.LOGIN,
        ipAddress: '127.0.0.1',
      });

      expect(sensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorAddress: '0xActor',
          action: SensitiveAuditAction.LOGIN,
          ipAddress: '127.0.0.1',
          targetAddress: null,
          resourceType: null,
          resourceId: null,
          patientId: null,
          tenantId: null,
          actorRole: null,
        }),
      );
      expect(sensitiveRepo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('uuid-1');
    });

    it('stores targetAddress and resourceType when provided', async () => {
      await service.log({
        actorAddress: '0xDoctor',
        action: SensitiveAuditAction.PHI_READ,
        targetAddress: '0xPatient',
        resourceType: 'MedicalRecord',
        resourceId: 'res-uuid',
      });

      expect(sensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAddress: '0xPatient',
          resourceType: 'MedicalRecord',
          resourceId: 'res-uuid',
        }),
      );
    });

    it('stores PHI context fields when provided', async () => {
      await service.log({
        actorAddress: '0xDoctor',
        action: SensitiveAuditAction.PHI_READ,
        patientId: 'patient-123',
        tenantId: 'tenant-abc',
        actorRole: 'NURSE',
      });

      expect(sensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'patient-123',
          tenantId: 'tenant-abc',
          actorRole: 'NURSE',
        }),
      );
    });

    it('defaults optional fields to null when not provided', async () => {
      await service.log({ actorAddress: '0xAdmin', action: SensitiveAuditAction.ADMIN_OPERATION });

      expect(sensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAddress: null,
          resourceType: null,
          resourceId: null,
          ipAddress: null,
          patientId: null,
          tenantId: null,
          actorRole: null,
        }),
      );
    });

    it('stores metadata when provided', async () => {
      await service.log({
        actorAddress: '0xActor',
        action: SensitiveAuditAction.GRANT_CHANGE,
        metadata: { reason: 'emergency access' },
      });

      expect(sensitiveRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { reason: 'emergency access' } }),
      );
    });
  });

  // ── findAllSensitive() ─────────────────────────────────────────────────────

  describe('findAllSensitive()', () => {
    it('returns paginated results with default page/pageSize', async () => {
      const result = await service.findAllSensitive({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
    });

    it('applies patientId filter', async () => {
      const query: QueryAuditLogsDto = { patientId: 'patient-uuid-123' };
      await service.findAllSensitive(query);

      expect(qb.andWhere).toHaveBeenCalledWith('al.patientId = :patientId', {
        patientId: 'patient-uuid-123',
      });
    });

    it('applies actorAddress filter', async () => {
      const query: QueryAuditLogsDto = { actorAddress: '0xActor' };
      await service.findAllSensitive(query);

      expect(qb.andWhere).toHaveBeenCalledWith('al.actorAddress = :actorAddress', {
        actorAddress: '0xActor',
      });
    });

    it('applies action filter', async () => {
      await service.findAllSensitive({ action: SensitiveAuditAction.PHI_READ });

      expect(qb.andWhere).toHaveBeenCalledWith('al.action = :action', {
        action: SensitiveAuditAction.PHI_READ,
      });
    });

    it('applies date range filters', async () => {
      await service.findAllSensitive({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'al.timestamp >= :startDate',
        expect.objectContaining({ startDate: expect.any(Date) }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'al.timestamp <= :endDate',
        expect.objectContaining({ endDate: expect.any(Date) }),
      );
    });

    it('respects custom page and pageSize', async () => {
      qb = makeQueryBuilder([], 50);
      sensitiveRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllSensitive({ page: 3, pageSize: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20); // (3-1)*10
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.meta.page).toBe(3);
      expect(result.meta.pageSize).toBe(10);
    });

    it('can combine patientId and action filters', async () => {
      await service.findAllSensitive({
        patientId: 'pat-99',
        action: SensitiveAuditAction.PHI_WRITE,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'al.patientId = :patientId',
        { patientId: 'pat-99' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'al.action = :action',
        { action: SensitiveAuditAction.PHI_WRITE },
      );
    });
  });
});

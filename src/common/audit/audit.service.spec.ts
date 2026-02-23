import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../../src/common/audit/audit.service';
import { AuditLogEntity } from '../../src/common/audit/audit-log.entity';
import { AuditEventAction } from '../../src/common/audit/dto/audit-event.dto';

const makeRepo = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  create: jest.fn((data) => ({ ...data })),
  save: jest.fn(async (e) => ({ id: 'uuid-test', ...e })),
  createQueryBuilder: jest.fn(() => ({
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn(async () => 1),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => [
      {
        id: 'uuid-test',
        userId: 'actor-1',
        action: 'RECORD_READ',
        resourceId: 'res-1',
        resourceType: 'MedicalRecord',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        stellarTxHash: null,
      },
    ]),
  })),
  ...overrides,
});

describe('AuditService', () => {
  let service: AuditService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLogEntity), useValue: repo },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('log()', () => {
    it('persists an AuditEventDto and returns the saved entity', async () => {
      const result = await service.log({
        actorId: 'actor-1',
        action: AuditEventAction.RECORD_READ,
        resourceId: 'res-1',
        resourceType: 'MedicalRecord',
        ipAddress: '127.0.0.1',
        userAgent: 'jest-agent',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'actor-1',
          action: AuditEventAction.RECORD_READ,
          resourceId: 'res-1',
          resourceType: 'MedicalRecord',
          ipAddress: '127.0.0.1',
          userAgent: 'jest-agent',
        }),
      );
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('uuid-test');
    });

    it('stores stellarTxHash when provided', async () => {
      await service.log({
        actorId: 'actor-2',
        action: AuditEventAction.ACCESS_GRANTED,
        stellarTxHash: 'abc123',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ stellarTxHash: 'abc123' }),
      );
    });

    it('defaults stellarTxHash to null when not provided', async () => {
      await service.log({ actorId: 'actor-3', action: AuditEventAction.RECORD_WRITE });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ stellarTxHash: null }),
      );
    });
  });

  describe('findAll()', () => {
    it('returns paginated results', async () => {
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('toCsv()', () => {
    it('returns a valid CSV string with header row', () => {
      const rows: Partial<AuditLogEntity>[] = [
        {
          id: 'uuid-1',
          userId: 'actor-1',
          action: 'RECORD_READ',
          resourceId: 'res-1',
          resourceType: 'MedicalRecord',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
          timestamp: new Date('2024-01-01T00:00:00.000Z'),
          stellarTxHash: null as unknown as string,
        },
      ];

      const csv = service.toCsv(rows as AuditLogEntity[]);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('id,actorId,action,resourceId,resourceType,ipAddress,userAgent,timestamp,stellarTxHash');
      expect(lines[1]).toContain('uuid-1');
      expect(lines[1]).toContain('2024-01-01T00:00:00.000Z');
    });

    it('wraps values containing commas in double quotes', () => {
      const rows: Partial<AuditLogEntity>[] = [
        {
          id: 'uuid-2',
          userId: 'a,b',
          action: 'RECORD_READ',
          timestamp: new Date('2024-01-01T00:00:00.000Z'),
        },
      ];
      const csv = service.toCsv(rows as AuditLogEntity[]);
      expect(csv).toContain('"a,b"');
    });
  });
});

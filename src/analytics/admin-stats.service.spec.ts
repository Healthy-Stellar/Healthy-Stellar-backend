import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AnalyticsService } from './analytics.service';
import { User } from '../users/entities/user.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';
import { StellarTransaction } from './entities/stellar-transaction.entity';
import { MedicalRole } from '../users/enums/medical-role.enum';

// ── Shared query-builder factory ──────────────────────────────────────────────
const qb = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(0),
  getRawMany: jest.fn().mockResolvedValue([]),
  ...overrides,
});

describe('AnalyticsService — getStats', () => {
  let service: AnalyticsService;
  let userRepo: any;
  let recordRepo: any;
  let grantRepo: any;
  let cache: any;

  beforeEach(async () => {
    userRepo = { count: jest.fn(), createQueryBuilder: jest.fn() };
    recordRepo = { count: jest.fn(), createQueryBuilder: jest.fn() };
    grantRepo = { count: jest.fn(), createQueryBuilder: jest.fn() };
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(MedicalRecord), useValue: recordRepo },
        { provide: getRepositoryToken(AccessGrant), useValue: grantRepo },
        { provide: getRepositoryToken(StellarTransaction), useValue: { count: jest.fn().mockResolvedValue(0), createQueryBuilder: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  // ── Seeded data scenario ───────────────────────────────────────────────────
  it('returns correct stats from seeded DB data', async () => {
    // Seed: 120 patients, 15 providers, 500 total records
    userRepo.count
      .mockResolvedValueOnce(120)  // totalPatients (role=PATIENT)
    userRepo.createQueryBuilder
      .mockReturnValueOnce(qb({ getCount: jest.fn().mockResolvedValue(15) })); // totalProviders

    recordRepo.count.mockResolvedValue(500); // totalRecords
    recordRepo.createQueryBuilder
      .mockReturnValueOnce(qb({ getCount: jest.fn().mockResolvedValue(42) }))  // last 7 days
      .mockReturnValueOnce(qb({ getCount: jest.fn().mockResolvedValue(180) })) // last 30 days
      .mockReturnValueOnce(qb({                                                 // top providers
        getRawMany: jest.fn().mockResolvedValue([
          { providerId: 'dr-1', recordCount: '95' },
          { providerId: 'dr-2', recordCount: '80' },
          { providerId: 'dr-3', recordCount: '60' },
          { providerId: 'dr-4', recordCount: '45' },
          { providerId: 'dr-5', recordCount: '30' },
        ]),
      }))
      .mockReturnValueOnce(qb({                                                 // by type
        getRawMany: jest.fn().mockResolvedValue([
          { recordType: 'consultation', count: '200' },
          { recordType: 'lab_result', count: '150' },
          { recordType: 'imaging', count: '100' },
          { recordType: 'prescription', count: '50' },
        ]),
      }));

    grantRepo.count.mockResolvedValue(88); // activeAccessGrants

    const result = await service.getStats();

    expect(result.totalPatients).toBe(120);
    expect(result.totalProviders).toBe(15);
    expect(result.totalRecords).toBe(500);
    expect(result.recordsLast7Days).toBe(42);
    expect(result.recordsLast30Days).toBe(180);
    expect(result.activeAccessGrants).toBe(88);
    expect(result.topProviders).toHaveLength(5);
    expect(result.topProviders[0]).toEqual({ providerId: 'dr-1', recordCount: 95 });
    expect(result.recordsByType).toHaveLength(4);
    expect(result.recordsByType[0]).toEqual({ recordType: 'consultation', count: 200 });
    expect(result.cachedAt).toBeDefined();
  });

  // ── Cache hit — no DB queries ──────────────────────────────────────────────
  it('returns cached result without hitting the DB', async () => {
    const cached = {
      totalPatients: 50, totalProviders: 5, totalRecords: 200,
      recordsLast7Days: 10, recordsLast30Days: 40,
      topProviders: [], recordsByType: [], activeAccessGrants: 20,
      cachedAt: new Date().toISOString(),
    };
    cache.get.mockResolvedValue(cached);

    const result = await service.getStats();

    expect(result).toEqual(cached);
    expect(userRepo.count).not.toHaveBeenCalled();
    expect(recordRepo.count).not.toHaveBeenCalled();
  });

  // ── Cache write on miss ────────────────────────────────────────────────────
  it('writes result to cache with 300s TTL on cache miss', async () => {
    userRepo.count.mockResolvedValue(0);
    userRepo.createQueryBuilder.mockReturnValue(qb());
    recordRepo.count.mockResolvedValue(0);
    recordRepo.createQueryBuilder.mockReturnValue(qb());
    grantRepo.count.mockResolvedValue(0);

    await service.getStats();

    expect(cache.set).toHaveBeenCalledWith('admin:stats', expect.any(Object), 300);
  });

  // ── Empty platform ─────────────────────────────────────────────────────────
  it('handles empty platform with all-zero counts', async () => {
    userRepo.count.mockResolvedValue(0);
    userRepo.createQueryBuilder.mockReturnValue(qb());
    recordRepo.count.mockResolvedValue(0);
    recordRepo.createQueryBuilder.mockReturnValue(qb());
    grantRepo.count.mockResolvedValue(0);

    const result = await service.getStats();

    expect(result.totalPatients).toBe(0);
    expect(result.totalProviders).toBe(0);
    expect(result.totalRecords).toBe(0);
    expect(result.recordsLast7Days).toBe(0);
    expect(result.recordsLast30Days).toBe(0);
    expect(result.topProviders).toEqual([]);
    expect(result.recordsByType).toEqual([]);
    expect(result.activeAccessGrants).toBe(0);
  });

  // ── Top providers capped at 5 ──────────────────────────────────────────────
  it('returns at most 5 top providers', async () => {
    userRepo.count.mockResolvedValue(10);
    userRepo.createQueryBuilder.mockReturnValue(qb());
    recordRepo.count.mockResolvedValue(100);
    recordRepo.createQueryBuilder
      .mockReturnValueOnce(qb())
      .mockReturnValueOnce(qb())
      .mockReturnValueOnce(qb({
        getRawMany: jest.fn().mockResolvedValue(
          Array.from({ length: 5 }, (_, i) => ({
            providerId: `dr-${i + 1}`,
            recordCount: String(50 - i * 5),
          })),
        ),
      }))
      .mockReturnValueOnce(qb());
    grantRepo.count.mockResolvedValue(0);

    const result = await service.getStats();

    expect(result.topProviders.length).toBeLessThanOrEqual(5);
  });

  // ── recordsLast7Days <= recordsLast30Days ──────────────────────────────────
  it('7-day count is always <= 30-day count', async () => {
    userRepo.count.mockResolvedValue(5);
    userRepo.createQueryBuilder.mockReturnValue(qb());
    recordRepo.count.mockResolvedValue(300);
    recordRepo.createQueryBuilder
      .mockReturnValueOnce(qb({ getCount: jest.fn().mockResolvedValue(20) }))
      .mockReturnValueOnce(qb({ getCount: jest.fn().mockResolvedValue(90) }))
      .mockReturnValueOnce(qb())
      .mockReturnValueOnce(qb());
    grantRepo.count.mockResolvedValue(0);

    const result = await service.getStats();

    expect(result.recordsLast7Days).toBeLessThanOrEqual(result.recordsLast30Days);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { User } from '../users/entities/user.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';
import { StellarTransaction } from './entities/stellar-transaction.entity';
import { TenantContext } from '../tenant/context/tenant.context';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQB(rawResult: any[] = [], countResult = 0) {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawResult),
    getCount: jest.fn().mockResolvedValue(countResult),
  };
  return qb;
}

function makeRepo(countResult = 0, qbResult: any[] = []) {
  return {
    count: jest.fn().mockResolvedValue(countResult),
    createQueryBuilder: jest.fn().mockReturnValue(makeQB(qbResult, countResult)),
  };
}

const mockCache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };

async function buildModule(repos: {
  user?: any; record?: any; grant?: any; stellar?: any;
} = {}) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AnalyticsService,
      { provide: getRepositoryToken(User), useValue: repos.user ?? makeRepo() },
      { provide: getRepositoryToken(MedicalRecord), useValue: repos.record ?? makeRepo() },
      { provide: getRepositoryToken(AccessGrant), useValue: repos.grant ?? makeRepo() },
      { provide: getRepositoryToken(StellarTransaction), useValue: repos.stellar ?? makeRepo() },
      { provide: CACHE_MANAGER, useValue: mockCache },
    ],
  }).compile();
  return module.get<AnalyticsService>(AnalyticsService);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('AnalyticsService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Tenant context guard ───────────────────────────────────────────────────

  describe('requireTenantId', () => {
    it('throws ForbiddenException when TenantContext is missing', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(undefined);
      const service = await buildModule();
      await expect(service.getOverview()).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── Cache key namespacing ──────────────────────────────────────────────────

  describe('cache key namespacing', () => {
    it('uses tenant-scoped cache key for getOverview', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-abc');
      const service = await buildModule();
      await service.getOverview();
      expect(mockCache.set).toHaveBeenCalledWith(
        'analytics:overview:tenant-abc',
        expect.any(Object),
        300,
      );
    });

    it('returns cached value for the correct tenant key', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-abc');
      const cached = { totalUsers: 99, totalRecords: 0, totalAccessGrants: 0, activeGrants: 0, stellarTransactions: 0 };
      mockCache.get.mockResolvedValueOnce(cached);
      const service = await buildModule();
      const result = await service.getOverview();
      expect(result).toEqual(cached);
      expect(mockCache.get).toHaveBeenCalledWith('analytics:overview:tenant-abc');
    });
  });

  // ── Two-tenant isolation ───────────────────────────────────────────────────

  describe('tenant data isolation', () => {
    it('each tenant sees only their own counts in getOverview', async () => {
      const tenantAId = 'tenant-aaa';
      const tenantBId = 'tenant-bbb';

      // Tenant A: 10 users, 50 records, 20 grants, 5 active, 3 stellar
      const repoA = {
        user: makeRepo(10),
        record: makeRepo(50),
        grant: {
          count: jest.fn()
            .mockResolvedValueOnce(20)  // totalAccessGrants
            .mockResolvedValueOnce(5),  // activeGrants
          createQueryBuilder: jest.fn().mockReturnValue(makeQB()),
        },
        stellar: makeRepo(3),
      };

      // Tenant B: 2 users, 8 records, 4 grants, 1 active, 0 stellar
      const repoB = {
        user: makeRepo(2),
        record: makeRepo(8),
        grant: {
          count: jest.fn()
            .mockResolvedValueOnce(4)
            .mockResolvedValueOnce(1),
          createQueryBuilder: jest.fn().mockReturnValue(makeQB()),
        },
        stellar: makeRepo(0),
      };

      const serviceA = await buildModule(repoA);
      const serviceB = await buildModule(repoB);

      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(tenantAId);
      const resultA = await serviceA.getOverview();

      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(tenantBId);
      const resultB = await serviceB.getOverview();

      expect(resultA.totalUsers).toBe(10);
      expect(resultA.totalRecords).toBe(50);
      expect(resultA.activeGrants).toBe(5);
      expect(resultA.stellarTransactions).toBe(3);

      expect(resultB.totalUsers).toBe(2);
      expect(resultB.totalRecords).toBe(8);
      expect(resultB.activeGrants).toBe(1);
      expect(resultB.stellarTransactions).toBe(0);
    });

    it('getOverview passes organizationId filter to every repository count', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-xyz');
      const userRepo = makeRepo(5);
      const recordRepo = makeRepo(10);
      const grantRepo = { count: jest.fn().mockResolvedValue(3), createQueryBuilder: jest.fn().mockReturnValue(makeQB()) };
      const stellarRepo = makeRepo(1);

      const service = await buildModule({ user: userRepo, record: recordRepo, grant: grantRepo, stellar: stellarRepo });
      await service.getOverview();

      expect(userRepo.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'tenant-xyz' }) }));
      expect(recordRepo.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'tenant-xyz' }) }));
      expect(grantRepo.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'tenant-xyz' }) }));
      expect(stellarRepo.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'tenant-xyz' }) }));
    });
  });

  // ── getActivity ────────────────────────────────────────────────────────────

  describe('getActivity', () => {
    it('scopes activity queries to tenant and returns daily breakdown', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-t1');
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-02');

      const recordQB = makeQB([{ date: '2024-01-01T00:00:00.000Z', count: '5' }]);
      const grantQB = makeQB([{ date: '2024-01-02T00:00:00.000Z', count: '3' }]);
      const recordRepo = { count: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(recordQB) };
      const grantRepo = { count: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(grantQB) };

      const service = await buildModule({ record: recordRepo, grant: grantRepo });
      const result = await service.getActivity(from, to);

      expect(result.dailyActivity).toHaveLength(2);
      expect(result.dailyActivity[0]).toEqual({ date: '2024-01-01', recordUploads: 5, accessEvents: 0 });
      expect(result.dailyActivity[1]).toEqual({ date: '2024-01-02', recordUploads: 0, accessEvents: 3 });

      // Verify tenant filter was applied
      expect(recordQB.where).toHaveBeenCalledWith(
        expect.stringContaining('organizationId'),
        expect.objectContaining({ tenantId: 'tenant-t1' }),
      );
    });

    it('uses tenant-scoped cache key', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-t2');
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-01');
      const recordQB = makeQB([]);
      const grantQB = makeQB([]);
      const service = await buildModule({
        record: { count: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(recordQB) },
        grant: { count: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(grantQB) },
      });

      await service.getActivity(from, to);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('analytics:activity:tenant-t2:'),
        expect.any(Object),
        300,
      );
    });
  });

  // ── getTopProviders ────────────────────────────────────────────────────────

  describe('getTopProviders', () => {
    it('filters by tenant and active status', async () => {
      jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-p1');
      const qb = makeQB([{ providerId: 'prov-1', activeGrantCount: '8' }]);
      const grantRepo = { count: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(qb) };

      const service = await buildModule({ grant: grantRepo });
      const result = await service.getTopProviders();

      expect(result.providers[0]).toEqual({ providerId: 'prov-1', activeGrantCount: 8 });
      expect(qb.where).toHaveBeenCalledWith('grant.status = :status', { status: GrantStatus.ACTIVE });
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('organizationId'),
        expect.objectContaining({ tenantId: 'tenant-p1' }),
      );
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from '../analytics.service';
import { AnalyticsRepository } from '../analytics.repository';

// ─── Repository mock ──────────────────────────────────────────────────────────

const mockOverview = {
  totalUsers: 1200,
  totalRecords: 45000,
  totalAccessGrants: 8900,
  activeGrants: 3200,
  stellarTransactions: 15000,
};

const mockSeries = [
  { date: '2024-01-01', recordUploads: 12, accessEvents: 55 },
  { date: '2024-01-02', recordUploads: 8, accessEvents: 40 },
];

const mockProviders = [
  { providerId: 'uuid-1', providerName: 'Acme Health', activeGrantCount: 500 },
  { providerId: 'uuid-2', providerName: 'Beta Clinic', activeGrantCount: 320 },
];

const repoMock = {
  getOverview: jest.fn().mockResolvedValue(mockOverview),
  getDailyActivity: jest.fn().mockResolvedValue(mockSeries),
  getTopProviders: jest.fn().mockResolvedValue(mockProviders),
};

// ─── Service tests ────────────────────────────────────────────────────────────

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: AnalyticsRepository, useValue: repoMock },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
    repoMock.getOverview.mockResolvedValue(mockOverview);
    repoMock.getDailyActivity.mockResolvedValue(mockSeries);
    repoMock.getTopProviders.mockResolvedValue(mockProviders);
  });

  describe('getOverview', () => {
    it('delegates to repository and returns metrics', async () => {
      const result = await service.getOverview();
      expect(result).toEqual(mockOverview);
      expect(repoMock.getOverview).toHaveBeenCalledTimes(1);
    });
  });

  describe('getActivity', () => {
    it('uses defaults when no dates supplied', async () => {
      const result = await service.getActivity();
      expect(result.series).toEqual(mockSeries);
      expect(repoMock.getDailyActivity).toHaveBeenCalledTimes(1);
      const [from, to] = repoMock.getDailyActivity.mock.calls[0];
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
      expect(to.getTime()).toBeGreaterThan(from.getTime());
    });

    it('parses explicit ISO date strings', async () => {
      await service.getActivity('2024-01-01', '2024-01-31');
      const [from, to] = repoMock.getDailyActivity.mock.calls[0];
      expect(from.toISOString().startsWith('2024-01-01')).toBe(true);
      expect(to.toISOString().startsWith('2024-01-31')).toBe(true);
    });

    it('throws BadRequestException when from > to', async () => {
      await expect(
        service.getActivity('2024-02-01', '2024-01-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when range exceeds 366 days', async () => {
      await expect(
        service.getActivity('2023-01-01', '2024-12-31'),
      ).rejects.toThrow(BadRequestException);
    });

    it('includes from/to in response envelope', async () => {
      const result = await service.getActivity('2024-01-01', '2024-01-31');
      expect(result).toHaveProperty('from');
      expect(result).toHaveProperty('to');
      expect(result).toHaveProperty('series');
    });
  });

  describe('getTopProviders', () => {
    it('returns providers list from repository', async () => {
      const result = await service.getTopProviders();
      expect(result).toEqual(mockProviders);
      expect(repoMock.getTopProviders).toHaveBeenCalledWith(10);
    });

    it('passes custom limit to repository', async () => {
      await service.getTopProviders(5);
      expect(repoMock.getTopProviders).toHaveBeenCalledWith(5);
    });
  });
});

// ─── Repository tests (DB mocked via DataSource) ─────────────────────────────

import { AnalyticsRepository } from '../analytics.repository';
import { DataSource } from 'typeorm';

describe('AnalyticsRepository', () => {
  let repo: AnalyticsRepository;
  const queryMock = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsRepository,
        {
          provide: DataSource,
          useValue: { query: queryMock },
        },
      ],
    }).compile();

    repo = module.get<AnalyticsRepository>(AnalyticsRepository);
    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('runs 5 parallel queries and maps results', async () => {
      queryMock
        .mockResolvedValueOnce([{ total_users: '1200' }])
        .mockResolvedValueOnce([{ total_records: '45000' }])
        .mockResolvedValueOnce([{ total_grants: '8900' }])
        .mockResolvedValueOnce([{ active_grants: '3200' }])
        .mockResolvedValueOnce([{ stellar_txns: '15000' }]);

      const result = await repo.getOverview();

      expect(queryMock).toHaveBeenCalledTimes(5);
      expect(result).toEqual({
        totalUsers: 1200,
        totalRecords: 45000,
        totalAccessGrants: 8900,
        activeGrants: 3200,
        stellarTransactions: 15000,
      });
    });
  });

  describe('getDailyActivity', () => {
    it('passes date params and maps rows', async () => {
      const rawRows = [
        { day: '2024-01-01', record_uploads: '12', access_events: '55' },
        { day: '2024-01-02', record_uploads: '8', access_events: '40' },
      ];
      queryMock.mockResolvedValue(rawRows);

      const from = new Date('2024-01-01');
      const to = new Date('2024-01-31');
      const result = await repo.getDailyActivity(from, to);

      expect(queryMock).toHaveBeenCalledTimes(1);
      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('date_trunc');
      expect(sql).toContain('generate_series');
      expect(params).toContain(from.toISOString());
      expect(result[0]).toEqual({ date: '2024-01-01', recordUploads: 12, accessEvents: 55 });
    });
  });

  describe('getTopProviders', () => {
    it('returns providers sorted by grant count', async () => {
      queryMock.mockResolvedValue([
        { provider_id: 'uuid-1', provider_name: 'Acme', active_grant_count: '500' },
      ]);

      const result = await repo.getTopProviders(10);

      expect(queryMock).toHaveBeenCalledTimes(1);
      const [sql] = queryMock.mock.calls[0];
      expect(sql).toContain('GROUP BY');
      expect(sql).toContain('ORDER BY active_grant_count DESC');
      expect(result[0].activeGrantCount).toBe(500);
    });
  });
});

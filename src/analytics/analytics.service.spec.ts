import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AnalyticsService } from './analytics.service';
import { User } from '../users/entities/user.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { StellarTransaction } from './entities/stellar-transaction.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let medicalRecordRepository: any;
  let accessGrantRepository: any;

  beforeEach(async () => {
    const mockRepository = {
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(MedicalRecord),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(AccessGrant),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(StellarTransaction),
          useValue: mockRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    medicalRecordRepository = module.get(getRepositoryToken(MedicalRecord));
    accessGrantRepository = module.get(getRepositoryToken(AccessGrant));
  });

  describe('getActivity', () => {
    it('should return daily activity with record uploads and access events', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-03');

      // Mock record uploads query
      const mockRecordQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { date: '2024-01-01T00:00:00.000Z', count: '5' },
          { date: '2024-01-02T00:00:00.000Z', count: '3' },
        ]),
      };

      // Mock access events query
      const mockAccessQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { date: '2024-01-01T00:00:00.000Z', count: '2' },
          { date: '2024-01-03T00:00:00.000Z', count: '4' },
        ]),
      };

      medicalRecordRepository.createQueryBuilder
        .mockReturnValueOnce(mockRecordQueryBuilder);
      accessGrantRepository.createQueryBuilder
        .mockReturnValueOnce(mockAccessQueryBuilder);

      const result = await service.getActivity(from, to);

      expect(result.dailyActivity).toHaveLength(3);
      expect(result.dailyActivity[0]).toEqual({
        date: '2024-01-01',
        recordUploads: 5,
        accessEvents: 2,
      });
      expect(result.dailyActivity[1]).toEqual({
        date: '2024-01-02',
        recordUploads: 3,
        accessEvents: 0,
      });
      expect(result.dailyActivity[2]).toEqual({
        date: '2024-01-03',
        recordUploads: 0,
        accessEvents: 4,
      });
    });

    it('should return zero counts for days with no activity', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-02');

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      medicalRecordRepository.createQueryBuilder
        .mockReturnValue(mockQueryBuilder);
      accessGrantRepository.createQueryBuilder
        .mockReturnValue(mockQueryBuilder);

      const result = await service.getActivity(from, to);

      expect(result.dailyActivity).toHaveLength(2);
      expect(result.dailyActivity[0]).toEqual({
        date: '2024-01-01',
        recordUploads: 0,
        accessEvents: 0,
      });
      expect(result.dailyActivity[1]).toEqual({
        date: '2024-01-02',
        recordUploads: 0,
        accessEvents: 0,
      });
    });

    it('should handle single day date range', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-01');

      const mockRecordQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { date: '2024-01-01T00:00:00.000Z', count: '10' },
        ]),
      };

      const mockAccessQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { date: '2024-01-01T00:00:00.000Z', count: '7' },
        ]),
      };

      medicalRecordRepository.createQueryBuilder
        .mockReturnValueOnce(mockRecordQueryBuilder);
      accessGrantRepository.createQueryBuilder
        .mockReturnValueOnce(mockAccessQueryBuilder);

      const result = await service.getActivity(from, to);

      expect(result.dailyActivity).toHaveLength(1);
      expect(result.dailyActivity[0]).toEqual({
        date: '2024-01-01',
        recordUploads: 10,
        accessEvents: 7,
      });
    });
  });
});

  describe('getTopProviders', () => {
    it('should return providers ranked by active grant count', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { providerId: 'provider-1', activeGrantCount: '15' },
          { providerId: 'provider-2', activeGrantCount: '10' },
          { providerId: 'provider-3', activeGrantCount: '5' },
        ]),
      };

      accessGrantRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTopProviders();

      expect(result.providers).toHaveLength(3);
      expect(result.providers[0]).toEqual({
        providerId: 'provider-1',
        activeGrantCount: 15,
      });
      expect(result.providers[1]).toEqual({
        providerId: 'provider-2',
        activeGrantCount: 10,
      });
      expect(result.providers[2]).toEqual({
        providerId: 'provider-3',
        activeGrantCount: 5,
      });
    });

    it('should return empty array when no active grants exist', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      accessGrantRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTopProviders();

      expect(result.providers).toHaveLength(0);
      expect(result.providers).toEqual([]);
    });

    it('should filter only active grants', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { providerId: 'provider-1', activeGrantCount: '8' },
        ]),
      };

      accessGrantRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getTopProviders();

      // Verify that the where clause filters for ACTIVE status
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'grant.status = :status',
        { status: 'ACTIVE' }
      );
    });
  });

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ProviderDirectoryService } from './provider-directory.service';
import { User, UserRole } from '../entities/user.entity';
import { ProviderDirectoryQueryDto } from '../dto/provider-directory-query.dto';

describe('ProviderDirectoryService', () => {
  let service: ProviderDirectoryService;
  let repository: Repository<User>;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };

  const mockRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderDirectoryService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ProviderDirectoryService>(ProviderDirectoryService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchProviders', () => {
    it('should return paginated results with full-text search match', async () => {
      const query: ProviderDirectoryQueryDto = {
        search: 'cardiology',
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '2' });
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: '1',
          displayName: 'Dr. John Doe',
          role: UserRole.PHYSICIAN,
          specialty: 'Cardiology',
          institution: 'General Hospital',
        },
        {
          id: '2',
          displayName: 'Dr. Jane Smith',
          role: UserRole.PHYSICIAN,
          specialty: 'Cardiology',
          institution: 'City Medical Center',
        },
      ]);

      const result = await service.searchProviders(query, false);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].displayName).toBe('Dr. John Doe');
      expect(result.data[0].specialty).toBe('Cardiology');
      expect(result.data[0]).not.toHaveProperty('stellarPublicKey');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('search_vector'),
        expect.objectContaining({ search: 'cardiology' }),
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        expect.stringContaining('ts_rank'),
        'DESC',
      );
    });

    it('should return empty results when no match found', async () => {
      const query: ProviderDirectoryQueryDto = {
        search: 'nonexistent',
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '0' });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.searchProviders(query, false);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle pagination correctly', async () => {
      const query: ProviderDirectoryQueryDto = {
        page: 3,
        limit: 10,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '50' });
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: '21',
          displayName: 'Dr. Provider 21',
          role: UserRole.PHYSICIAN,
          specialty: 'General Practice',
          institution: 'Clinic',
        },
      ]);

      const result = await service.searchProviders(query, false);

      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(result.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 50,
      });
    });

    it('should include stellarPublicKey for authenticated users', async () => {
      const query: ProviderDirectoryQueryDto = {
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '1' });
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: '1',
          displayName: 'Dr. John Doe',
          role: UserRole.PHYSICIAN,
          specialty: 'Cardiology',
          institution: 'General Hospital',
          stellarPublicKey: 'GABC123XYZ',
        },
      ]);

      const result = await service.searchProviders(query, true);

      expect(result.data[0]).toHaveProperty('stellarPublicKey', 'GABC123XYZ');
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'u."stellarPublicKey"',
        'stellarPublicKey',
      );
    });

    it('should exclude stellarPublicKey for unauthenticated users', async () => {
      const query: ProviderDirectoryQueryDto = {
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '1' });
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: '1',
          displayName: 'Dr. John Doe',
          role: UserRole.PHYSICIAN,
          specialty: 'Cardiology',
          institution: 'General Hospital',
        },
      ]);

      const result = await service.searchProviders(query, false);

      expect(result.data[0]).not.toHaveProperty('stellarPublicKey');
    });

    it('should filter by role', async () => {
      const query: ProviderDirectoryQueryDto = {
        role: 'doctor',
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '1' });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.searchProviders(query, false);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'u.role = :role',
        { role: UserRole.PHYSICIAN },
      );
    });

    it('should filter by specialty', async () => {
      const query: ProviderDirectoryQueryDto = {
        specialty: 'Cardiology',
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '1' });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.searchProviders(query, false);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        { specialty: '%Cardiology%' },
      );
    });

    it('should sort by relevance when search is provided', async () => {
      const query: ProviderDirectoryQueryDto = {
        search: 'cardiology',
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '1' });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.searchProviders(query, false);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        expect.stringContaining('ts_rank'),
        'DESC',
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('u."createdAt"', 'DESC');
    });

    it('should sort by createdAt when no search is provided', async () => {
      const query: ProviderDirectoryQueryDto = {
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '1' });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.searchProviders(query, false);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('u."createdAt"', 'DESC');
    });

    it('should map role aliases correctly', async () => {
      const queries = [
        { role: 'doctor' as const, expected: UserRole.PHYSICIAN },
        { role: 'lab' as const, expected: UserRole.MEDICAL_RECORDS },
        { role: 'insurer' as const, expected: UserRole.BILLING_STAFF },
      ];

      for (const { role, expected } of queries) {
        jest.clearAllMocks();
        mockQueryBuilder.getRawOne.mockResolvedValue({ total: '0' });
        mockQueryBuilder.getRawMany.mockResolvedValue([]);

        await service.searchProviders({ role, page: 1, limit: 20 }, false);

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('u.role = :role', {
          role: expected,
        });
      }
    });

    it('should handle null specialty and institution', async () => {
      const query: ProviderDirectoryQueryDto = {
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '1' });
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: '1',
          displayName: 'Dr. John Doe',
          role: UserRole.PHYSICIAN,
          specialty: null,
          institution: null,
        },
      ]);

      const result = await service.searchProviders(query, false);

      expect(result.data[0].specialty).toBeNull();
      expect(result.data[0].institution).toBeNull();
    });

    it('should use default pagination values', async () => {
      const query: ProviderDirectoryQueryDto = {
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '1' });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.searchProviders(query, false);

      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(20);
    });
  });
});

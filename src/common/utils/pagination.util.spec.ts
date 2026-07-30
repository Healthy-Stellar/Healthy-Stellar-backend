import { PaginationUtil } from './pagination.util';
import { PaginationDto } from '../dto/pagination.dto';
import { Repository } from 'typeorm';

describe('PaginationUtil', () => {
  describe('calculateMeta', () => {
    it('should calculate correct metadata for first page', () => {
      const meta = PaginationUtil.calculateMeta(100, 1, 20);

      expect(meta).toEqual({
        total: 100,
        page: 1,
        pageSize: 20,
        totalPages: 5,
        hasNextPage: true,
        hasPrevPage: false,
      });
    });

    it('should calculate correct metadata for middle page', () => {
      const meta = PaginationUtil.calculateMeta(100, 3, 20);

      expect(meta).toEqual({
        total: 100,
        page: 3,
        pageSize: 20,
        totalPages: 5,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });

    it('should calculate correct metadata for last page', () => {
      const meta = PaginationUtil.calculateMeta(100, 5, 20);

      expect(meta).toEqual({
        total: 100,
        page: 5,
        pageSize: 20,
        totalPages: 5,
        hasNextPage: false,
        hasPrevPage: true,
      });
    });

    it('should handle partial last page', () => {
      const meta = PaginationUtil.calculateMeta(95, 5, 20);

      expect(meta).toEqual({
        total: 95,
        page: 5,
        pageSize: 20,
        totalPages: 5,
        hasNextPage: false,
        hasPrevPage: true,
      });
    });

    it('should handle single page', () => {
      const meta = PaginationUtil.calculateMeta(10, 1, 20);

      expect(meta).toEqual({
        total: 10,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('should handle empty results', () => {
      const meta = PaginationUtil.calculateMeta(0, 1, 20);

      expect(meta).toEqual({
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });
  });

  describe('createResponse', () => {
    it('should create paginated response with data and meta', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const response = PaginationUtil.createResponse(data, 100, 1, 20);

      expect(response.data).toEqual(data);
      expect(response.meta).toEqual({
        total: 100,
        page: 1,
        pageSize: 20,
        totalPages: 5,
        hasNextPage: true,
        hasPrevPage: false,
      });
    });
  });

  describe('paginate', () => {
    let mockRepository: jest.Mocked<Repository<any>>;

    beforeEach(() => {
      mockRepository = {
        findAndCount: jest.fn(),
      } as any;
    });

    it('should paginate with default values', async () => {
      const mockData = [{ id: 1 }, { id: 2 }];
      mockRepository.findAndCount.mockResolvedValue([mockData, 100]);

      const paginationDto: PaginationDto = {};
      const result = await PaginationUtil.paginate(mockRepository, paginationDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
      });
      expect(result.data).toEqual(mockData);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
      expect(result.meta.total).toBe(100);
    });

    it('should paginate with custom page and pageSize', async () => {
      const mockData = [{ id: 3 }, { id: 4 }];
      mockRepository.findAndCount.mockResolvedValue([mockData, 100]);

      const paginationDto: PaginationDto = { page: 2, pageSize: 10 };
      const result = await PaginationUtil.paginate(mockRepository, paginationDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
      });
      expect(result.data).toEqual(mockData);
      expect(result.meta.page).toBe(2);
      expect(result.meta.pageSize).toBe(10);
    });

    it('should pass additional options to findAndCount', async () => {
      const mockData = [{ id: 1 }];
      mockRepository.findAndCount.mockResolvedValue([mockData, 50]);

      const paginationDto: PaginationDto = { page: 1, pageSize: 20 };
      const options = {
        where: { status: 'active' },
        order: { createdAt: 'DESC' as const },
      };

      await PaginationUtil.paginate(mockRepository, paginationDto, options);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { status: 'active' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('paginateQueryBuilder', () => {
    it('should paginate with query builder', async () => {
      const mockData = [{ id: 1 }, { id: 2 }];
      const mockQueryBuilder = {
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockData, 100]),
      };

      const paginationDto: PaginationDto = { page: 2, pageSize: 20 };
      const result = await PaginationUtil.paginateQueryBuilder(mockQueryBuilder, paginationDto);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(result.data).toEqual(mockData);
      expect(result.meta.page).toBe(2);
      expect(result.meta.total).toBe(100);
    });
  });

  describe('getPaginationOptions', () => {
    it('should return skip and take with default values', () => {
      const paginationDto: PaginationDto = {};
      const options = PaginationUtil.getPaginationOptions(paginationDto);

      expect(options).toEqual({
        skip: 0,
        take: 20,
      });
    });

    it('should calculate skip and take for custom page', () => {
      const paginationDto: PaginationDto = { page: 3, pageSize: 10 };
      const options = PaginationUtil.getPaginationOptions(paginationDto);

      expect(options).toEqual({
        skip: 20,
        take: 10,
      });
    });

    it('should handle page 1 correctly', () => {
      const paginationDto: PaginationDto = { page: 1, pageSize: 50 };
      const options = PaginationUtil.getPaginationOptions(paginationDto);

      expect(options).toEqual({
        skip: 0,
        take: 50,
      });
    });
  });
});

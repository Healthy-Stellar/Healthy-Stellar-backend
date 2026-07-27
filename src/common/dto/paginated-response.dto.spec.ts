import {
  PaginatedResponseDto,
  PaginationMetaDto,
  createPaginatedResponseDto,
} from './paginated-response.dto';

class TestEntity {
  id: number;
  name: string;
}

describe('PaginatedResponseDto', () => {
  describe('constructor', () => {
    it('should create instance with data and meta', () => {
      const data = [{ id: 1, name: 'Test' }];
      const meta: PaginationMetaDto = {
        total: 100,
        page: 1,
        pageSize: 20,
        totalPages: 5,
        hasNextPage: true,
        hasPrevPage: false,
      };

      const response = new PaginatedResponseDto(data, meta);

      expect(response.data).toEqual(data);
      expect(response.meta).toEqual(meta);
    });

    it('should handle empty data array', () => {
      const data: any[] = [];
      const meta: PaginationMetaDto = {
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      };

      const response = new PaginatedResponseDto(data, meta);

      expect(response.data).toEqual([]);
      expect(response.meta.total).toBe(0);
    });
  });

  describe('createPaginatedResponseDto', () => {
    it('should create typed paginated response class', () => {
      const PaginatedTestEntity = createPaginatedResponseDto(TestEntity);

      expect(PaginatedTestEntity.name).toBe('PaginatedTestEntityResponseDto');
    });

    it('should create instance with proper typing', () => {
      const PaginatedTestEntity = createPaginatedResponseDto(TestEntity);

      const data = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' },
      ];
      const meta: PaginationMetaDto = {
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      };

      const response = new PaginatedTestEntity(data, meta);

      expect(response.data).toEqual(data);
      expect(response.meta).toEqual(meta);
      expect(response).toBeInstanceOf(PaginatedResponseDto);
    });
  });
});

describe('PaginationMetaDto', () => {
  it('should have all required properties', () => {
    const meta: PaginationMetaDto = {
      total: 100,
      page: 1,
      pageSize: 20,
      totalPages: 5,
      hasNextPage: true,
      hasPrevPage: false,
    };

    expect(meta.total).toBe(100);
    expect(meta.page).toBe(1);
    expect(meta.pageSize).toBe(20);
    expect(meta.totalPages).toBe(5);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPrevPage).toBe(false);
  });
});

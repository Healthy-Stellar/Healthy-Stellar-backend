import { Repository, FindManyOptions, FindOptionsWhere } from 'typeorm';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto, PaginationMetaDto } from '../dto/paginated-response.dto';

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export class PaginationUtil {
  /**
   * Calculate pagination metadata
   */
  static calculateMeta(total: number, page: number, pageSize: number): PaginationMetaDto {
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage,
      hasPrevPage,
    };
  }

  /**
   * Create a paginated response
   */
  static createResponse<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number,
  ): PaginatedResponseDto<T> {
    const meta = this.calculateMeta(total, page, pageSize);
    return new PaginatedResponseDto(data, meta);
  }

  /**
   * Paginate using TypeORM repository with findAndCount
   */
  static async paginate<T>(
    repository: Repository<T>,
    paginationDto: PaginationDto,
    options?: Omit<FindManyOptions<T>, 'skip' | 'take'>,
  ): Promise<PaginatedResponseDto<T>> {
    const { page = 1, pageSize = 20 } = paginationDto;
    const skip = (page - 1) * pageSize;

    const [data, total] = await repository.findAndCount({
      ...options,
      skip,
      take: pageSize,
    });

    return this.createResponse(data, total, page, pageSize);
  }

  /**
   * Paginate with custom query builder
   */
  static async paginateQueryBuilder<T>(
    queryBuilder: any,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<T>> {
    const { page = 1, pageSize = 20 } = paginationDto;
    const skip = (page - 1) * pageSize;

    const [data, total] = await queryBuilder.skip(skip).take(pageSize).getManyAndCount();

    return this.createResponse(data, total, page, pageSize);
  }

  /**
   * Get pagination options for manual queries
   */
  static getPaginationOptions(paginationDto: PaginationDto): {
    skip: number;
    take: number;
  } {
    const { page = 1, pageSize = 20 } = paginationDto;
    return {
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
  }
}

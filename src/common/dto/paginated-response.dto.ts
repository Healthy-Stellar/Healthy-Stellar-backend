import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PaginationMetaDto {
  @ApiProperty({
    description: 'Total number of items',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number (1-indexed)',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  pageSize: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  hasNextPage: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPrevPage: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({
    description: 'Array of items',
    isArray: true,
  })
  data: T[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta: PaginationMetaDto;

  constructor(data: T[], meta: PaginationMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}

/**
 * Factory function to create a typed PaginatedResponseDto class for Swagger documentation
 * @param classRef The class type for the data items
 * @returns A class that extends PaginatedResponseDto with proper typing
 */
export function createPaginatedResponseDto<T>(classRef: Type<T>) {
  class PaginatedResponse extends PaginatedResponseDto<T> {
    @ApiProperty({
      description: 'Array of items',
      type: classRef,
      isArray: true,
    })
    data: T[];
  }

  Object.defineProperty(PaginatedResponse, 'name', {
    value: `Paginated${classRef.name}ResponseDto`,
  });

  return PaginatedResponse;
}

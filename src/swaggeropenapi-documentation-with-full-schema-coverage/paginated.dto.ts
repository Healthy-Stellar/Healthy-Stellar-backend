// src/common/dto/paginated.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from '@nestjs/common';

export function PaginatedDto<T>(ItemDto: Type<T>) {
  class PaginatedDtoClass {
    @ApiProperty({ isArray: true, type: () => ItemDto })
    data: T[];

    @ApiProperty({ example: 1, description: 'Current page (1-indexed)' })
    page: number;

    @ApiProperty({ example: 20, description: 'Items per page' })
    limit: number;

    @ApiProperty({ example: 100, description: 'Total matching items' })
    total: number;

    @ApiProperty({ example: 5, description: 'Total pages' })
    totalPages: number;
  }

  Object.defineProperty(PaginatedDtoClass, 'name', {
    value: `Paginated${ItemDto.name}`,
  });

  return PaginatedDtoClass;
}

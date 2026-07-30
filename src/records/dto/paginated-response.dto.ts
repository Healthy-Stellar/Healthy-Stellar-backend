import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto, PaginationMetaDto } from '../../common/dto/paginated-response.dto';
import { Record } from '../entities/record.entity';

export class PaginationMeta {
  @ApiProperty({ description: 'Total number of items', example: 150 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 8 })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page', example: true })
  hasNextPage: boolean;

  @ApiProperty({ description: 'Whether there is a previous page', example: false })
  hasPreviousPage: boolean;

  @ApiProperty({
    description: 'ID of the last item on this page — use as keyset cursor for stable next-page fetch',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  nextCursor: string | null;
}

export class PaginatedRecordsResponseDto {
  @ApiProperty({
    description: 'Array of records',
    type: [Record],
  })
  data: Record[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta: PaginationMetaDto;
}

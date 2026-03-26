import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto, PaginationMetaDto } from '../../common/dto/paginated-response.dto';
import { Record } from '../entities/record.entity';

export class PaginatedRecordsResponseDto extends PaginatedResponseDto<Record> {
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

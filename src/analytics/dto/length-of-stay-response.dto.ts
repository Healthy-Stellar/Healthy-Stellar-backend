import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/paginated-response.dto';

export class LengthOfStayRowDto {
  @ApiProperty()
  wardId: string;

  @ApiProperty()
  wardName: string;

  @ApiProperty({ description: 'Calendar month the stay started in, formatted YYYY-MM' })
  month: string;

  @ApiProperty({ description: 'Number of completed bed assignments (stays) ending or measured in this month' })
  stayCount: number;

  @ApiProperty({ description: 'Average length of stay in days for this ward/month' })
  averageLengthOfStayDays: number;
}

export class LengthOfStayReportDto {
  @ApiProperty({ type: [LengthOfStayRowDto] })
  data: LengthOfStayRowDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

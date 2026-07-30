import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/paginated-response.dto';

export class ReadmissionRateRowDto {
  @ApiProperty({ description: 'ICD-10 category, e.g. medical_codes.category or the code itself when no category is set' })
  icd10Category: string;

  @ApiProperty({ description: 'Number of index diagnoses in this category within the reporting window' })
  indexEpisodeCount: number;

  @ApiProperty({ description: 'Number of those index episodes followed by a same-category diagnosis within 30 days' })
  readmissionCount: number;

  @ApiProperty({ description: 'readmissionCount / indexEpisodeCount, as a percentage (0-100)' })
  readmissionRatePercent: number;
}

export class ReadmissionRateReportDto {
  @ApiProperty({ type: [ReadmissionRateRowDto] })
  data: ReadmissionRateRowDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

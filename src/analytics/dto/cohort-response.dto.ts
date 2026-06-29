import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/paginated-response.dto';

export class CohortPatientSummaryDto {
  @ApiProperty()
  patientId: string;

  @ApiProperty({ required: false, nullable: true })
  ageYears: number | null;

  @ApiProperty({ required: false, nullable: true })
  admissionDate: string | null;

  @ApiProperty({ required: false, nullable: true })
  dischargeDate: string | null;

  @ApiProperty({ required: false, nullable: true })
  lengthOfStayDays: number | null;

  @ApiProperty({ required: false, nullable: true })
  wardId: string | null;
}

export class CohortStatisticsDto {
  @ApiProperty({ description: 'Number of patients matching the cohort filters' })
  count: number;

  @ApiProperty({ description: 'Average length of stay in days across matched, discharged patients', nullable: true })
  averageLengthOfStayDays: number | null;

  @ApiProperty({ description: 'Average age in years across matched patients', nullable: true })
  averageAgeYears: number | null;

  @ApiProperty({ description: 'Number of matched patients currently admitted' })
  currentlyAdmittedCount: number;
}

export class CohortQueryResponseDto {
  @ApiProperty({ type: [CohortPatientSummaryDto] })
  data: CohortPatientSummaryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;

  @ApiProperty({ type: CohortStatisticsDto })
  statistics: CohortStatisticsDto;
}

import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReportFormat } from '../entities/report-job.entity';

export class GenerateReportDto {
  @ApiProperty({ enum: ReportFormat, description: 'Report format (pdf or csv)' })
  @IsEnum(ReportFormat)
  format: ReportFormat;

  @ApiProperty({ description: 'Patient ID' })
  @IsString()
  patientId: string;
}

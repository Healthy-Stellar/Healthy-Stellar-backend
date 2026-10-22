import { IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ComplianceReportType } from '../entities/compliance-report-job.entity';

export class GenerateComplianceReportDto {
  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-01-31' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ enum: ComplianceReportType, example: ComplianceReportType.HIPAA })
  @IsEnum(ComplianceReportType)
  reportType: ComplianceReportType;
}

import { IsOptional, IsArray, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BulkExportQueryDto {
  @ApiPropertyOptional({ description: 'Resource types to export', example: 'Patient,DocumentReference' })
  @IsOptional()
  @IsArray()
  @IsIn(['Patient', 'DocumentReference', 'Consent', 'Provenance'], { each: true })
  _type?: string[];
}

export interface BulkExportStatusResponse {
  transactionTime: string;
  request: string;
  requiresAccessToken: boolean;
  output: Array<{ type: string; url: string; count: number }>;
  error?: Array<{ type: string; url: string }>;
}

import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../dto/pagination.dto';

export enum PhiAuditAction {
  READ = 'READ',
  WRITE = 'WRITE',
  DELETE = 'DELETE',
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_REVOKED = 'ACCESS_REVOKED',
  EXPORT = 'EXPORT',
}

export class QueryAuditLogsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by patient ID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Filter by actor address (user ID or wallet address)' })
  @IsString()
  @IsOptional()
  actorAddress?: string;

  @ApiPropertyOptional({ description: 'Filter by actor user ID (alternative to actorAddress)' })
  @IsString()
  @IsOptional()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Filter by action type' })
  @ApiPropertyOptional({ description: 'Filter by action type (e.g. PHI_READ, PHI_WRITE, PHI_DELETE, GRANT_CHANGE)' })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter by PHI audit action type',
    enum: PhiAuditAction,
  })
  @IsEnum(PhiAuditAction)
  @IsOptional()
  actionType?: PhiAuditAction;

  @ApiPropertyOptional({ description: "Filter by patient's resource ID" })
  @IsString()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @ApiPropertyOptional({ description: 'Start date (ISO 8601)', example: '2024-01-01T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)', example: '2024-12-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

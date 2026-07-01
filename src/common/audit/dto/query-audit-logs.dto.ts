import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
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
  @ApiPropertyOptional({ description: 'Filter by actor address' })
  @IsString()
  @IsOptional()
  actorAddress?: string;

  @ApiPropertyOptional({ description: 'Filter by actor user ID (alternative to actorAddress)' })
  @IsString()
  @IsOptional()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Filter by action type' })
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
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

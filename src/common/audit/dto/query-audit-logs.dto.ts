import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../dto/pagination.dto';

export class QueryAuditLogsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by actor address' })
  @IsString()
  @IsOptional()
  actorAddress?: string;

  @ApiPropertyOptional({ description: 'Filter by action type' })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

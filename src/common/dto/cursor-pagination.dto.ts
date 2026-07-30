import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CursorPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for the next page of results (Base64 encoded)',
    type: String,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of records to return',
    minimum: 1,
    maximum: 500,
    default: 50,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 50;
}
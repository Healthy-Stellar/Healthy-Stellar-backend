import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ProviderDirectoryQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAcceptingPatients?: boolean;

  @IsOptional()
  @IsIn(['doctor', 'lab', 'insurer'])
  role?: 'doctor' | 'lab' | 'insurer';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

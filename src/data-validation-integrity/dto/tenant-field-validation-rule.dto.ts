import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TenantFieldRuleType } from '../entities/tenant-field-validation-rule.entity';

export class CreateTenantFieldValidationRuleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  fieldName: string;

  @ApiPropertyOptional({ enum: TenantFieldRuleType, default: TenantFieldRuleType.STRING })
  @IsOptional()
  @IsEnum(TenantFieldRuleType)
  type?: TenantFieldRuleType;

  @ApiPropertyOptional({ description: 'Regex source (no delimiters), required when type is REGEX' })
  @IsOptional()
  @IsString()
  pattern?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class UpdateTenantFieldValidationRuleDto {
  @ApiPropertyOptional({ enum: TenantFieldRuleType })
  @IsOptional()
  @IsEnum(TenantFieldRuleType)
  type?: TenantFieldRuleType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pattern?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

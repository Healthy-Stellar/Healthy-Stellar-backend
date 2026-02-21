import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength, IsArray, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ConfigValueType } from '../entities/tenant-config.entity';

export class UpdateTenantConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255, { message: 'Configuration key must not exceed 255 characters' })
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000, { message: 'Configuration value must not exceed 10000 characters' })
  value: string;

  @IsOptional()
  @IsIn([
    ConfigValueType.STRING,
    ConfigValueType.NUMBER,
    ConfigValueType.BOOLEAN,
    ConfigValueType.JSON,
    ConfigValueType.ARRAY,
  ])
  valueType?: ConfigValueType;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;
}

export class BulkUpdateTenantConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateTenantConfigDto)
  @ArrayMaxSize(50, { message: 'Bulk update limited to 50 configurations' })
  @IsNotEmpty()
  configs: UpdateTenantConfigDto[];
}

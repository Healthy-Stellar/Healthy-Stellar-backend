import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  ArrayNotEmpty,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderSetTemplateItemDto {
  @ApiProperty({ description: 'Lab test ID' })
  @IsUUID()
  @IsNotEmpty()
  labTestId: string;

  @ApiPropertyOptional({ description: 'Notes for this test within the panel' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

export class CreateOrderSetTemplateDto {
  @ApiProperty({ description: 'Template name', example: 'Complete Blood Count (CBC)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Tenant ID (null = available to all tenants)' })
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Department ID (null = available to all departments)' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ description: 'Lab tests in the order set', type: [OrderSetTemplateItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderSetTemplateItemDto)
  items: OrderSetTemplateItemDto[];
}

export class UpdateOrderSetTemplateDto {
  @ApiPropertyOptional({ description: 'Template name' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Department ID' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Lab tests in the order set', type: [OrderSetTemplateItemDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OrderSetTemplateItemDto)
  items?: OrderSetTemplateItemDto[];
}

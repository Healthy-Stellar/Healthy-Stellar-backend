import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsDateString,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderPriority } from '../entities/lab-order.entity';

export class CreateLabOrderItemDto {
  @ApiProperty({
    description: 'Lab test ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  labTestId: string;

  @ApiPropertyOptional({
    description: 'Additional notes for this test',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateLabOrderDto {
  @ApiProperty({
    description: 'Patient ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({
    description: 'Patient name',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  patientName: string;

  @ApiProperty({
    description: 'Ordering provider ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsUUID()
  @IsNotEmpty()
  orderingProviderId: string;

  @ApiProperty({
    description: 'Ordering provider name',
    example: 'Dr. Jane Smith',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  orderingProviderName: string;

  @ApiProperty({
    enum: OrderPriority,
    description: 'Order priority',
    example: OrderPriority.ROUTINE,
  })
  @IsEnum(OrderPriority)
  @IsNotEmpty()
  priority: OrderPriority;

  @ApiPropertyOptional({
    description: 'Order date (ISO 8601 format)',
    example: '2024-01-26T10:30:00Z',
  })
  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @ApiPropertyOptional({
    description: 'Clinical indication or reason for test',
    example: 'Routine annual physical examination',
  })
  @IsString()
  @IsOptional()
  clinicalIndication?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Department ID',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Department name',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  departmentName?: string;

  @ApiProperty({
    description: 'Lab tests to order',
    type: [CreateLabOrderItemDto],
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateLabOrderItemDto)
  items: CreateLabOrderItemDto[];

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

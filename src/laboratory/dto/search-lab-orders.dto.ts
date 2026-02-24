import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, OrderPriority } from '../entities/lab-order.entity';
import { TestCategory } from '../entities/lab-test.entity';

export class SearchLabOrdersDto {
  @ApiPropertyOptional({
    description: 'Patient ID',
  })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({
    description: 'Ordering provider ID',
  })
  @IsUUID()
  @IsOptional()
  orderingProviderId?: string;

  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Order status',
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: OrderPriority,
    description: 'Order priority',
  })
  @IsEnum(OrderPriority)
  @IsOptional()
  priority?: OrderPriority;

  @ApiPropertyOptional({
    description: 'Order number',
  })
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @ApiPropertyOptional({
    description: 'Start date for order date range (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for order date range (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Department ID',
  })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({
    enum: TestCategory,
    description: 'Filter by test category',
  })
  @IsEnum(TestCategory)
  @IsOptional()
  testCategory?: TestCategory;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;
}

import { PartialType } from '@nestjs/swagger';
import { CreateLabOrderDto } from './create-lab-order.dto';
import { IsEnum, IsOptional, IsDateString, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../entities/lab-order.entity';

export class UpdateLabOrderDto extends PartialType(CreateLabOrderDto) {
  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Order status',
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Collection date (ISO 8601 format)',
  })
  @IsDateString()
  @IsOptional()
  collectionDate?: string;

  @ApiPropertyOptional({
    description: 'Cancellation reason',
  })
  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @ApiPropertyOptional({
    description: 'Cancelled by user ID',
  })
  @IsUUID()
  @IsOptional()
  cancelledBy?: string;
}

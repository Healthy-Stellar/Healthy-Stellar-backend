import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeStatus } from '../entities/billing-dispute.entity';

export class UpdateDisputeDto {
  @ApiProperty({ enum: DisputeStatus, description: 'New dispute status' })
  @IsEnum(DisputeStatus)
  status: DisputeStatus;

  @ApiPropertyOptional({ description: 'Updated notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'ID of the user resolving the dispute' })
  @IsOptional()
  @IsString()
  resolvedBy?: string;
}

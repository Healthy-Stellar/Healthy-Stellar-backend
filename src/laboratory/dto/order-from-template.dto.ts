import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderFromTemplateDto {
  @ApiProperty({ description: 'Order set template ID' })
  @IsUUID()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: 'Patient ID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Patient name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  patientName: string;

  @ApiProperty({ description: 'Ordering provider ID' })
  @IsUUID()
  @IsNotEmpty()
  orderingProviderId: string;

  @ApiProperty({ description: 'Ordering provider name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  orderingProviderName: string;

  @ApiPropertyOptional({ description: 'Order priority', example: 'routine' })
  @IsString()
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional({ description: 'Encounter/visit ID to link orders to' })
  @IsString()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Clinical indication' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  clinicalIndication?: string;

  @ApiPropertyOptional({ description: 'Order date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @ApiPropertyOptional({ description: 'Department ID' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Department name' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  departmentName?: string;
}

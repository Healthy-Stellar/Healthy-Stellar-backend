import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRecordFromTemplateDto {
  @ApiProperty({ description: 'Patient ID to associate the record with' })
  @IsString()
  patientId: string;

  @ApiPropertyOptional({ description: 'Optional description to override template default' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional field values to merge into the template schema' })
  @IsOptional()
  fieldValues?: Record<string, any>;
}

import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCorrectionRequestDto {
  @ApiProperty({ description: 'ID of the record to correct' })
  @IsUUID()
  @IsNotEmpty()
  recordId: string;

  @ApiProperty({ description: 'Type of record (e.g. medical_record, appointment, billing)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  recordType: string;

  @ApiProperty({ description: 'Name of the field to correct' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fieldName: string;

  @ApiPropertyOptional({ description: 'Current (incorrect) value for reference' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  currentValue?: string;

  @ApiProperty({ description: 'Proposed correct value' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  proposedValue: string;

  @ApiPropertyOptional({ description: 'Justification or reason for the correction' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  justification?: string;
}

export class ReviewCorrectionRequestDto {
  @ApiProperty({ description: 'Decision: approved or rejected' })
  @IsString()
  @IsNotEmpty()
  decision: 'approved' | 'rejected';

  @ApiPropertyOptional({ description: 'Reviewer notes' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  reviewNotes?: string;
}

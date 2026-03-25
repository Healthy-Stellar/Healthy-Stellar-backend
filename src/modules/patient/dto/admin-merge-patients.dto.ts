import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminMergePatientsDto {
  @ApiProperty({ description: 'The address (ID) of the primary patient account that will absorb the records' })
  @IsString()
  @IsNotEmpty()
  primaryAddress: string;

  @ApiProperty({ description: 'The address (ID) of the secondary patient account that will be marked as merged' })
  @IsString()
  @IsNotEmpty()
  secondaryAddress: string;

  @ApiPropertyOptional({ description: 'Optional reason for the merge' })
  @IsOptional()
  @IsString()
  reason?: string;
}

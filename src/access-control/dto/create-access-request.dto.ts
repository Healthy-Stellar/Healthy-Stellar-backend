import { IsUUID, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAccessRequestDto {
  @ApiProperty({ description: 'Patient user ID to request access from' })
  @IsUUID()
  patientAddress: string;

  @ApiProperty({
    description: 'Clinical reason for requesting access (20–500 chars)',
    minLength: 20,
    maxLength: 500,
  })
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  reason: string;
}

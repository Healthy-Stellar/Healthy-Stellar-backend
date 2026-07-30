import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AmendRecordDto {
  @ApiProperty({
    description: 'Reason for the amendment — must be at least 20 characters',
    example: 'Lab result value corrected after instrument recalibration',
    minLength: 20,
  })
  @IsString()
  @MinLength(20, { message: 'amendmentReason must be at least 20 characters' })
  amendmentReason: string;
}

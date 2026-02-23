import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateEmergencyAccessDto {
  @ApiProperty({ description: 'Whether emergency access override is enabled for this user' })
  @IsBoolean()
  enabled: boolean;
}

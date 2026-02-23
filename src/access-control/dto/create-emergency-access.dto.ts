import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateEmergencyAccessDto {
  @ApiProperty({ description: 'Patient ID for emergency access' })
  @IsUUID()
  patientId: string;

  @ApiProperty({
    description: 'Detailed emergency justification',
    minLength: 50,
  })
  @IsString()
  @MinLength(50)
  emergencyReason: string;
}

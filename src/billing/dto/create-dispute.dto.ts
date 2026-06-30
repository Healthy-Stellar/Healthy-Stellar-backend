import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDisputeDto {
  @ApiProperty({ description: 'Remittance ID to dispute' })
  @IsUUID()
  remittanceId: string;

  @ApiProperty({ description: 'Notes explaining the dispute' })
  @IsString()
  notes: string;
}

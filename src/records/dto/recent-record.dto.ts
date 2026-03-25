import { ApiProperty } from '@nestjs/swagger';
import { RecordType } from './create-record.dto';

export class RecentRecordDto {
  @ApiProperty({ description: 'The unique identifier of the record' })
  recordId: string;

  @ApiProperty({ description: 'The truncated address of the patient' })
  patientAddress: string;

  @ApiProperty({ description: 'The address of the provider' })
  providerAddress: string;

  @ApiProperty({ description: 'The type of the medical record', enum: RecordType })
  recordType: RecordType;

  @ApiProperty({ description: 'The timestamp when the record was created' })
  createdAt: Date;
}

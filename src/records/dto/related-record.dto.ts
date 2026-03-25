import { ApiProperty } from '@nestjs/swagger';
import { RecordType } from './create-record.dto';

export class RelatedRecordDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  patientId: string;

  @ApiProperty({ nullable: true })
  providerId: string | null;

  @ApiProperty({ enum: RecordType })
  recordType: RecordType;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ description: 'Relevance score: sameType(3) + sameProvider(2) + within30Days(1)' })
  score: number;

  @ApiProperty({ description: 'Reasons this record is related', type: [String] })
  reasons: string[];
}

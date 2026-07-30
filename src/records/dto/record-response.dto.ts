import { ApiProperty } from '@nestjs/swagger';
import { RecordType } from './create-record.dto';

export class RecordResponseDto {
  @ApiProperty({ description: 'Record identifier' })
  id: string;

  @ApiProperty({ description: 'Patient identifier' })
  patientId: string;

  @ApiProperty({ enum: RecordType, description: 'Medical record type' })
  recordType: RecordType;

  @ApiProperty({ description: 'Record description', nullable: true })
  description: string | null;

  @ApiProperty({ description: 'Stellar transaction hash', nullable: true })
  stellarTxHash: string;

  @ApiProperty({ description: 'Record creation timestamp' })
  createdAt: Date;

  @ApiProperty({
    description: 'IPFS content identifier. Returned only to the owning patient.',
    required: false,
  })
  cid?: string;
}

import { ApiProperty } from '@nestjs/swagger';

export class AuditVerifyResponseDto {
  @ApiProperty({ description: 'Whether the hash chain is valid' })
  valid: boolean;

  @ApiProperty({ description: 'Starting entry ID of the verified range' })
  fromId: string;

  @ApiProperty({ description: 'Ending entry ID of the verified range' })
  toId: string;

  @ApiProperty({ description: 'Total number of entries verified' })
  totalEntries: number;

  @ApiProperty({ description: 'Stellar transaction ID anchoring the root hash', required: false })
  stellarTxId?: string;

  @ApiProperty({ description: 'Error message if verification failed', required: false })
  error?: string;
}

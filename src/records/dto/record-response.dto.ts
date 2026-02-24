import { ApiProperty } from '@nestjs/swagger';

export class RecordResponseDto {
  @ApiProperty({ description: 'IPFS Content Identifier' })
  cid: string;

  @ApiProperty({ description: 'Encrypted payload from IPFS' })
  encryptedPayload: string;

  @ApiProperty({ description: 'Record metadata' })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Stellar transaction hash' })
  stellarTxHash: string;
}

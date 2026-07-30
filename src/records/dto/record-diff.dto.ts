import { ApiProperty } from '@nestjs/swagger';

export type ChangeType = 'added' | 'modified' | 'removed';

export class FieldChangeDto {
  @ApiProperty({ description: 'The metadata field name that changed' })
  field: string;

  @ApiProperty({ description: 'Value in the "from" version', nullable: true })
  oldValue: unknown;

  @ApiProperty({ description: 'Value in the "to" version', nullable: true })
  newValue: unknown;

  @ApiProperty({ enum: ['added', 'modified', 'removed'] })
  changeType: ChangeType;
}

export class RecordDiffResponseDto {
  @ApiProperty() recordId: string;
  @ApiProperty() fromVersion: number;
  @ApiProperty() toVersion: number;

  @ApiProperty({ type: [FieldChangeDto] })
  changes: FieldChangeDto[];

  @ApiProperty() amendedBy: string;
  @ApiProperty() amendmentReason: string;
  @ApiProperty() amendedAt: string;

  @ApiProperty({
    description: 'True when the underlying encrypted file differs between versions',
  })
  binaryContentChanged: boolean;
}

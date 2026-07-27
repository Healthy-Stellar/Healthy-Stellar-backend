import { ApiProperty } from '@nestjs/swagger';

export class SearchRecordItem {
  @ApiProperty() id: string;
  @ApiProperty() patientId: string;
  @ApiProperty({ nullable: true }) providerId: string | null;
  @ApiProperty({ nullable: true }) stellarTxHash: string | null;
  @ApiProperty() recordType: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() createdAt: Date;
  // cid is intentionally omitted for non-owners — populated only when caller is the owner
  @ApiProperty({ nullable: true }) cid?: string;
}

export class SearchRecordsMeta {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() totalPages: number;
}

export class SearchRecordsResponseDto {
  @ApiProperty({ type: [SearchRecordItem] }) data: SearchRecordItem[];
  @ApiProperty({ type: SearchRecordsMeta }) meta: SearchRecordsMeta;
}

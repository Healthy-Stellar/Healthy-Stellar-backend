import { ApiProperty } from '@nestjs/swagger';

export class RecordVersionMetaDto {
  @ApiProperty() id: string;
  @ApiProperty() recordId: string;
  @ApiProperty() version: number;
  @ApiProperty() cid: string;
  @ApiProperty({ nullable: true }) stellarTxHash: string | null;
  @ApiProperty() amendedBy: string;
  @ApiProperty() amendmentReason: string;
  @ApiProperty() createdAt: Date;
}

export class PaginatedVersionsResponseDto {
  @ApiProperty({ type: [RecordVersionMetaDto] })
  data: RecordVersionMetaDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export class AmendRecordResponseDto {
  @ApiProperty() recordId: string;
  @ApiProperty() version: number;
  @ApiProperty() cid: string;
  @ApiProperty({ nullable: true }) stellarTxHash: string | null;
}

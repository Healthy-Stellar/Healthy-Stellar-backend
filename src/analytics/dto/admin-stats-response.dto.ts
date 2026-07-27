import { ApiProperty } from '@nestjs/swagger';

export class RecordsByTypeDto {
  @ApiProperty() recordType: string;
  @ApiProperty() count: number;
}

export class TopProviderDto {
  @ApiProperty() providerId: string;
  @ApiProperty() recordCount: number;
}

export class AdminStatsResponseDto {
  @ApiProperty() totalPatients: number;
  @ApiProperty() totalProviders: number;
  @ApiProperty() totalRecords: number;
  @ApiProperty() recordsLast7Days: number;
  @ApiProperty() recordsLast30Days: number;
  @ApiProperty({ type: [TopProviderDto] }) topProviders: TopProviderDto[];
  @ApiProperty({ type: [RecordsByTypeDto] }) recordsByType: RecordsByTypeDto[];
  @ApiProperty() activeAccessGrants: number;
  @ApiProperty() cachedAt: string;
}

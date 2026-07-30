import { IsNumber, IsString } from 'class-validator';

export class OverviewResponseDto {
  @IsNumber()
  totalUsers: number;

  @IsNumber()
  totalRecords: number;

  @IsNumber()
  totalAccessGrants: number;

  @IsNumber()
  activeGrants: number;

  @IsNumber()
  stellarTransactions: number;

  /** ISO-8601 timestamp of when this snapshot was taken inside the transaction. */
  @IsString()
  lastUpdatedAt: string;
}

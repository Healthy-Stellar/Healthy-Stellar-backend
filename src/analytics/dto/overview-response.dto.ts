import { IsNumber } from 'class-validator';

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
}

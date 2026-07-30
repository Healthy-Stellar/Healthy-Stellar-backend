import { ApiProperty } from '@nestjs/swagger';

export class BedUtilizationDto {
  @ApiProperty() total: number;
  @ApiProperty() occupied: number;
  @ApiProperty() available: number;
  @ApiProperty() utilizationRate: number;
  @ApiProperty() warningThresholdBreached: boolean;
}

export class OrUtilizationDto {
  @ApiProperty() total: number;
  @ApiProperty() occupied: number;
  @ApiProperty() available: number;
  @ApiProperty() utilizationRate: number;
  @ApiProperty() warningThresholdBreached: boolean;
  @ApiProperty() upcomingCases: number;
}

export class OperationalDashboardDto {
  @ApiProperty() tenantId: string;
  @ApiProperty() asOf: string;
  @ApiProperty({ type: BedUtilizationDto }) bedUtilization: BedUtilizationDto;
  @ApiProperty({ type: OrUtilizationDto }) orUtilization: OrUtilizationDto;
  @ApiProperty({ type: [String] }) alerts: string[];
}

export class UtilizationTrendPointDto {
  @ApiProperty() date: string;
  @ApiProperty() bedUtilizationRate: number;
  @ApiProperty() orUtilizationRate: number;
}

export class UtilizationTrendDto {
  @ApiProperty({ type: [UtilizationTrendPointDto] }) trend: UtilizationTrendPointDto[];
}

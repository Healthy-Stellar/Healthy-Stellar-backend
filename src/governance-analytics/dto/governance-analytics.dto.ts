import { ApiProperty } from '@nestjs/swagger';

export class TimeSeriesPointDto {
  @ApiProperty() timestamp: number;
  @ApiProperty() value: number;
}

export class TreasuryPointDto {
  @ApiProperty() timestamp: number;
  @ApiProperty() balance: string;
}

export class TimeSeriesDataDto {
  @ApiProperty({ type: [TimeSeriesPointDto] }) dailyProposals: TimeSeriesPointDto[];
  @ApiProperty({ type: [TimeSeriesPointDto] }) dailyVotes: TimeSeriesPointDto[];
  @ApiProperty({ type: [TimeSeriesPointDto] }) dailyParticipation: TimeSeriesPointDto[];
  @ApiProperty({ type: [TreasuryPointDto] }) treasuryBalanceHistory: TreasuryPointDto[];
}

export class VotingBlocDto {
  @ApiProperty({ type: [String] }) members: string[];
  @ApiProperty() cohesionScore: number;
  @ApiProperty() combinedPower: string;
}

export class VotingPatternsDto {
  @ApiProperty({ type: Object }) voterAlignment: Record<string, number>;
  @ApiProperty() whaleInfluence: number;
  @ApiProperty() voteDistributionGini: number;
  @ApiProperty({ type: [VotingBlocDto] }) votingBlocs: VotingBlocDto[];
}

export class GovernanceAnalyticsDto {
  @ApiProperty() totalProposals: number;
  @ApiProperty() activeProposals: number;
  @ApiProperty({ type: Object }) proposalsByStatus: Record<string, number>;
  @ApiProperty() avgParticipationRate: number;
  @ApiProperty() avgApprovalRate: number;
  @ApiProperty() uniqueVoters: number;
  @ApiProperty() uniqueProposers: number;
  @ApiProperty() governanceHealthScore: number;
  @ApiProperty({ type: TimeSeriesDataDto }) timeSeries: TimeSeriesDataDto;
  @ApiProperty({ type: VotingPatternsDto }) votingPatterns: VotingPatternsDto;
}

export class HealthScoreDto {
  @ApiProperty() score: number;
  @ApiProperty() participationComponent: number;
  @ApiProperty() diversityComponent: number;
  @ApiProperty() successRateComponent: number;
  @ApiProperty() treasuryComponent: number;
  @ApiProperty() activityComponent: number;
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';
import {
  OverviewMetrics,
  ActivityMetrics,
  TopProvider,
} from './dto/activity-query.dto';

const DEFAULT_RANGE_DAYS = 30;

@Injectable()
export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  async getOverview(): Promise<OverviewMetrics> {
    return this.repo.getOverview();
  }

  async getActivity(from?: string, to?: string): Promise<ActivityMetrics> {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(
          Date.now() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000,
        );

    if (fromDate > toDate) {
      throw new BadRequestException('`from` must be before `to`');
    }

    // Guard against absurdly wide ranges that would blow the SLA
    const diffDays =
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 366) {
      throw new BadRequestException(
        'Date range cannot exceed 366 days. Use a narrower window.',
      );
    }

    const series = await this.repo.getDailyActivity(fromDate, toDate);

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      series,
    };
  }

  async getTopProviders(limit = 10): Promise<TopProvider[]> {
    return this.repo.getTopProviders(limit);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OutbreakAlertsService } from './outbreak-alerts.service';

// The installed @nestjs/schedule version does not expose a
// CronExpression.EVERY_15_MINUTES constant, so the equivalent 6-field cron
// expression (seconds minutes hours day month weekday) is used directly.
const EVERY_15_MINUTES = '0 */15 * * * *';

/**
 * Background job (Issue #633): every 15 minutes, evaluates all active
 * OutbreakThreshold configurations against recent InfectionCase volume and
 * raises deduplicated OutbreakAlert records with notification delivery.
 */
@Injectable()
export class OutbreakThresholdTask {
  private readonly logger = new Logger(OutbreakThresholdTask.name);

  constructor(private readonly outbreakAlertsService: OutbreakAlertsService) {}

  @Cron(EVERY_15_MINUTES)
  async evaluateOutbreakThresholds(): Promise<void> {
    const results = await this.outbreakAlertsService.evaluateAllThresholds();
    const created = results.filter((r) => r.alertCreated).length;

    if (created > 0) {
      this.logger.warn(`Outbreak threshold evaluation raised ${created} new alert(s).`);
    } else {
      this.logger.debug(
        `Outbreak threshold evaluation completed: ${results.length} threshold(s) checked, no new alerts.`,
      );
    }
  }
}

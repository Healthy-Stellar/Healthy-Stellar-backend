import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SlowQueryAlertService {
  private readonly logger = new Logger(SlowQueryAlertService.name);

  /**
   * Sends an ops alert when slow query count exceeds threshold within a window.
   * Hook this up to your notification channel (email, PagerDuty, Slack, etc.)
   */
  async sendOpsAlert(count: number, windowMs: number): Promise<void> {
    const windowSec = Math.round(windowMs / 1000);
    this.logger.error(
      `[OPS ALERT] ${count} slow queries detected in the last ${windowSec}s — investigate database performance`,
    );
    // Extend here: inject NotificationsService / MailService and send a real alert
  }
}

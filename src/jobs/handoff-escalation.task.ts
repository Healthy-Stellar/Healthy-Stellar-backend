import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HandoffService } from '../provider-patient/services/handoff.service';

@Injectable()
export class HandoffEscalationTask {
  private readonly logger = new Logger(HandoffEscalationTask.name);

  constructor(private readonly handoffService: HandoffService) {}

  @Cron('*/5 * * * *')
  async handleStaleHandoffs(): Promise<void> {
    this.logger.debug('Running handoff escalation check');
    try {
      // No escalation resolver is wired yet, so the service logs each stale
      // handoff and leaves it unescalated. The service claims each handoff
      // atomically and only marks it ESCALATED after a notification is accepted.
      await this.handoffService.escalateStaleHandoffs();
    } catch (err) {
      this.logger.error(
        `Handoff escalation task failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

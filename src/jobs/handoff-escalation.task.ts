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
      // Escalation targets are resolved per tenant/department inside the
      // service (department head or charge nurse). The service also claims
      // each handoff atomically and only marks it ESCALATED after a
      // notification is accepted, so no global DEPARTMENT_HEAD_ID is used.
      await this.handoffService.escalateStaleHandoffs();
    } catch (err) {
      this.logger.error(
        `Handoff escalation task failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { HandoffService } from '../provider-patient/services/handoff.service';

@Injectable()
export class HandoffEscalationTask {
  private readonly logger = new Logger(HandoffEscalationTask.name);

  constructor(
    private readonly handoffService: HandoffService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('*/5 * * * *')
  async handleStaleHandoffs(): Promise<void> {
    this.logger.debug('Running handoff escalation check');
    const departmentHeadId = this.configService.get<string>(
      'DEPARTMENT_HEAD_ID',
      'department-head',
    );
    try {
      await this.handoffService.escalateStaleHandoffs(departmentHeadId);
    } catch (err) {
      this.logger.error(
        `Handoff escalation task failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

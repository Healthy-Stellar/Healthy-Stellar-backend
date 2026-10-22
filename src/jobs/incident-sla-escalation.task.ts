import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IncidentManagementService } from '../incident/services/incident-management.service';

@Injectable()
export class IncidentSlaEscalationTask {
  private readonly logger = new Logger(IncidentSlaEscalationTask.name);

  constructor(private readonly incidentService: IncidentManagementService) {}

  @Cron('*/5 * * * *')
  async handleSlaBreaches(): Promise<void> {
    this.logger.debug('Running incident SLA breach check');
    try {
      await this.incidentService.checkAndEscalateSlaBreaches();
    } catch (err) {
      this.logger.error(`SLA escalation task failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}

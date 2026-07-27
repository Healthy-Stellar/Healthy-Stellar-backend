import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CriticalAlertsService } from '../services/critical-alerts.service';
import {
  CRITICAL_VALUE_DETECTED,
  CriticalValueDetectedEvent,
} from '../events/critical-value-detected.event';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AlertStatus } from '../entities/critical-value-alert.entity';

const ESCALATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class CriticalValueEventHandler {
  private readonly logger = new Logger(CriticalValueEventHandler.name);

  constructor(
    private readonly criticalAlertsService: CriticalAlertsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(CRITICAL_VALUE_DETECTED, { async: true })
  async handleCriticalValueDetected(event: CriticalValueDetectedEvent): Promise<void> {
    this.logger.log(
      `Critical value detected — alertId: ${event.alertId}, provider: ${event.providerId}`,
    );

    await this.criticalAlertsService.notifyProvider(
      event.alertId,
      event.testName,
      event.value,
      event.unit,
      event.patientId,
    );
  }

  /**
   * Every minute, check for NOTIFIED alerts older than 15 minutes and escalate them.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async escalateUnacknowledgedAlerts(): Promise<void> {
    const overdue = await this.criticalAlertsService.findPendingEscalation(ESCALATION_WINDOW_MS);

    for (const alert of overdue) {
      this.logger.warn(
        `Escalating unacknowledged critical alert ${alert.id} (notified at ${alert.notificationDate})`,
      );

      await this.criticalAlertsService.escalate(alert.id, 'system', 'No acknowledgment within 15 minutes');

      // Notify charge nurse via metadata flag so the notification layer can route it
      this.notificationsService.emitRecordAmended('system', alert.id, {
        type: 'critical_value_escalation',
        originalProviderId: alert.notifiedTo,
        alertId: alert.id,
        escalatedAt: new Date().toISOString(),
      });
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationEventType } from '../interfaces/notification-event.interface';

export interface OnChainEvent {
  type: 'new_record' | 'access_grant' | 'access_revoke';
  patientId: string;
  actorId: string;
  resourceId: string;
  txHash?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class OnChainEventListenerService {
  private readonly logger = new Logger(OnChainEventListenerService.name);

  private static readonly EVENT_MAP: Record<OnChainEvent['type'], NotificationEventType> = {
    new_record: NotificationEventType.RECORD_UPLOADED,
    access_grant: NotificationEventType.ACCESS_GRANTED,
    access_revoke: NotificationEventType.ACCESS_REVOKED,
  };

  constructor(private readonly notificationsService: NotificationsService) {}

  async handleOnChainEvent(event: OnChainEvent): Promise<void> {
    const notificationType = OnChainEventListenerService.EVENT_MAP[event.type];
    if (!notificationType) {
      this.logger.warn(`Unknown on-chain event type: ${event.type}`);
      return;
    }

    this.logger.log(
      `On-chain event [${event.type}] → notification [${notificationType}] for patient ${event.patientId}`,
    );

    await this.notificationsService.notifyOnChainEvent(
      notificationType,
      event.actorId,
      event.resourceId,
      event.patientId,
      { txHash: event.txHash, ...event.metadata },
    );
  }
}

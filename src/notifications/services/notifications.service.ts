import { Injectable, Logger } from '@nestjs/common';
import { NotificationEvent, NotificationEventType } from '../interfaces/notification-event.interface';
import { NotificationsGateway } from '../notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private gateway: NotificationsGateway) {}
  constructor(private gateway: NotificationsGateway) { }

  emitRecordAccessed(actorId: string, resourceId: string, metadata?: Record<string, any>): void {
    this.emitEvent({
      eventType: NotificationEventType.RECORD_ACCESSED,
      actorId,
      resourceId,
      timestamp: new Date(),
      metadata,
    });
  }

  emitAccessGranted(actorId: string, resourceId: string, metadata?: Record<string, any>): void {
    this.emitEvent({
      eventType: NotificationEventType.ACCESS_GRANTED,
      actorId,
      resourceId,
      timestamp: new Date(),
      metadata,
    });
  }

  emitAccessRevoked(actorId: string, resourceId: string, metadata?: Record<string, any>): void {
    this.emitEvent({
      eventType: NotificationEventType.ACCESS_REVOKED,
      actorId,
      resourceId,
      timestamp: new Date(),
      metadata,
    });
  }

  emitRecordUploaded(actorId: string, resourceId: string, metadata?: Record<string, any>): void {
    this.emitEvent({
      eventType: NotificationEventType.RECORD_UPLOADED,
      actorId,
      resourceId,
      timestamp: new Date(),
      metadata,
    });
  }

  emitEmergencyAccess(actorId: string, resourceId: string, metadata?: Record<string, any>): void {
    this.emitEvent({
      eventType: NotificationEventType.EMERGENCY_ACCESS,
      actorId,
      resourceId,
      timestamp: new Date(),
      metadata,
    });
  }

  async sendPatientEmailNotification(patientId: string, subject: string, message: string): Promise<void> {
    // Placeholder until a dedicated mail transport is wired into the app.
    this.logger.log(`Email notification queued for patient ${patientId}: ${subject} - ${message}`);
  }

  async sendEmail(to: string, subject: string, template: string, context: Record<string, any>): Promise<void> {
    console.log(`[Mock Email] Sent to ${to}: ${subject}`);
    this.emitEvent({
      eventType: 'REPORT_READY' as any,
      actorId: 'system',
      resourceId: to,
      timestamp: new Date(),
      metadata: context,
    });
  }

  private emitEvent(event: NotificationEvent): void {
    this.gateway.emitNotification(event);
  }
}

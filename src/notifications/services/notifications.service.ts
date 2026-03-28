import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphqlPubSubService } from '../../pubsub/services/graphql-pubsub.service';
import {
  NotificationEvent,
  NotificationEventType,
} from '../interfaces/notification-event.interface';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateService } from './notification-template.service';

export const MAILER_SERVICE = 'MAILER_SERVICE';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly emailEnabled: boolean;

  constructor(
    private readonly graphqlPubSubService: GraphqlPubSubService,
    private readonly preferencesService: NotificationPreferencesService,
    private readonly configService: ConfigService,
    private readonly templateService: NotificationTemplateService,
    @Optional() @Inject(MAILER_SERVICE) private readonly mailerService?: any,
  ) {
    this.emailEnabled =
      this.configService.get<string>('ENABLE_EMAIL_NOTIFICATIONS', 'false') === 'true';
  }

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

  emitRecordAmended(actorId: string, resourceId: string, metadata?: Record<string, any>): void {
    this.emitEvent({
      eventType: NotificationEventType.RECORD_AMENDED,
      actorId,
      resourceId,
      timestamp: new Date(),
      metadata,
    });
  }

  async notifyOnChainEvent(
    eventType: NotificationEventType,
    actorId: string,
    resourceId: string,
    patientId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const event: NotificationEvent = {
      eventType,
      actorId,
      resourceId,
      timestamp: new Date(),
      metadata: { ...metadata, targetUserId: patientId },
    };

    const preferenceKey = this.eventTypeToPreferenceKey(eventType);
    const realtimeEnabled = preferenceKey
      ? await this.preferencesService.isChannelEnabled(patientId, 'webSocket', preferenceKey)
      : true;

    if (realtimeEnabled) {
      await this.publishRealtimeEvent(event);
    }

    if (this.emailEnabled && preferenceKey) {
      const emailEnabled = await this.preferencesService.isChannelEnabled(
        patientId,
        'email',
        preferenceKey,
      );
      if (emailEnabled) {
        await this.sendEmailNotification(event, patientId);
      }
    }
  }

  resolveLocalizedNotification(
    eventType: NotificationEventType,
    preferredLanguage: string,
    args: Record<string, any> = {},
  ) {
    return this.templateService.resolve(eventType, preferredLanguage, args);
  }

  async sendPatientEmailNotification(
    patientId: string,
    subject: string,
    message: string,
    preferredLanguage = 'en',
  ): Promise<void> {
    this.logger.log(
      `Email notification queued for patient ${patientId} [lang=${preferredLanguage}]: ${subject} - ${message}`,
    );
  }

  async sendEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, any>,
  ): Promise<void> {
    if (!this.emailEnabled || !this.mailerService) {
      this.logger.log(`[Mock Email] Sent to ${to}: ${subject}`);
      return;
    }
    await this.mailerService.sendMail({ to, subject, template, context });
  }

  private emitEvent(event: NotificationEvent): void {
    this.publishRealtimeEvent(event).catch((error: any) => {
      this.logger.warn(`Failed to publish realtime event ${event.eventType}: ${error?.message}`);
    });
  }

  private async publishRealtimeEvent(event: NotificationEvent): Promise<void> {
    const patientId = this.resolvePatientId(event.actorId, event.metadata);
    const timestamp = event.timestamp.toISOString();

    switch (event.eventType) {
      case NotificationEventType.RECORD_ACCESSED:
        await this.graphqlPubSubService.publishRecordAccessed(patientId, {
          patientId,
          actorId: event.actorId,
          recordId: event.resourceId,
          timestamp,
        });
        return;
      case NotificationEventType.ACCESS_GRANTED:
        await this.graphqlPubSubService.publishAccessGranted(patientId, {
          patientId,
          actorId: event.actorId,
          grantId: event.resourceId,
          granteeId: event.metadata?.granteeId,
          timestamp,
        });
        return;
      case NotificationEventType.ACCESS_REVOKED:
        await this.graphqlPubSubService.publishAccessRevoked(patientId, {
          patientId,
          actorId: event.actorId,
          grantId: event.resourceId,
          reason: event.metadata?.revocationReason,
          timestamp,
        });
        return;
      case NotificationEventType.RECORD_UPLOADED:
        await this.graphqlPubSubService.publishRecordUploaded(patientId, {
          patientId,
          actorId: event.actorId,
          recordId: event.resourceId,
          timestamp,
        });
        return;
      default:
        return;
    }
  }

  private resolvePatientId(actorId: string, metadata?: Record<string, any>): string {
    return metadata?.targetUserId ?? metadata?.patientId ?? actorId;
  }

  private async sendEmailNotification(
    event: NotificationEvent,
    patientId: string,
  ): Promise<void> {
    if (!this.mailerService) {
      this.logger.debug(`Email skipped (no mailer): ${event.eventType} for patient ${patientId}`);
      return;
    }

    try {
      await this.mailerService.sendMail({
        to: patientId,
        subject: this.buildEmailSubject(event.eventType),
        template: this.eventTypeToTemplate(event.eventType),
        context: {
          eventType: event.eventType,
          actorId: event.actorId,
          resourceId: event.resourceId,
          timestamp: event.timestamp,
          ...event.metadata,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to send email for ${event.eventType}: ${error?.message}`);
    }
  }

  private eventTypeToPreferenceKey(
    eventType: NotificationEventType,
  ): 'newRecord' | 'accessGranted' | 'accessRevoked' | null {
    switch (eventType) {
      case NotificationEventType.RECORD_UPLOADED:
        return 'newRecord';
      case NotificationEventType.ACCESS_GRANTED:
        return 'accessGranted';
      case NotificationEventType.ACCESS_REVOKED:
        return 'accessRevoked';
      default:
        return null;
    }
  }

  private buildEmailSubject(eventType: NotificationEventType): string {
    const subjects: Partial<Record<NotificationEventType, string>> = {
      [NotificationEventType.RECORD_UPLOADED]: 'New medical record added to your account',
      [NotificationEventType.ACCESS_GRANTED]: 'Access to your records has been granted',
      [NotificationEventType.ACCESS_REVOKED]: 'Access to your records has been revoked',
    };
    return subjects[eventType] ?? 'Health record notification';
  }

  private eventTypeToTemplate(eventType: NotificationEventType): string {
    const templates: Partial<Record<NotificationEventType, string>> = {
      [NotificationEventType.RECORD_UPLOADED]: 'record-uploaded',
      [NotificationEventType.ACCESS_GRANTED]: 'access-granted',
      [NotificationEventType.ACCESS_REVOKED]: 'access-revoked',
    };
    return templates[eventType] ?? 'generic-notification';
  }
}

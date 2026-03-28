import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationEvent,
  NotificationEventType,
} from '../interfaces/notification-event.interface';
import { NotificationsGateway } from '../notifications.gateway';
import { NotificationPreferencesService } from './notification-preferences.service';

export const MAILER_SERVICE = 'MAILER_SERVICE';
import { NotificationTemplateService } from './notification-template.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly emailEnabled: boolean;

  constructor(
    private readonly gateway: NotificationsGateway,
    private readonly preferencesService: NotificationPreferencesService,
    private readonly configService: ConfigService,
    @Optional() @Inject(MAILER_SERVICE) private readonly mailerService?: any,
  ) {
    this.emailEnabled =
      this.configService.get<string>('ENABLE_EMAIL_NOTIFICATIONS', 'false') === 'true';
  }
    private gateway: NotificationsGateway,
    private templateService: NotificationTemplateService,
  ) {}

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

    const wsEnabled = preferenceKey
      ? await this.preferencesService.isChannelEnabled(patientId, 'webSocket', preferenceKey)
      : true;

    if (wsEnabled) {
      this.gateway.emitNotification(event);
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
  /**
   * Resolve a localized notification message for a patient.
   * Falls back to English when the preferred language is unsupported or the key is missing.
   */
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

  async sendPatientEmailNotification(
    patientId: string,
    subject: string,
    message: string,
  ): Promise<void> {
    this.logger.log(`Email notification queued for patient ${patientId}: ${subject} - ${message}`);
  }

  private emitEvent(event: NotificationEvent): void {
    this.gateway.emitNotification(event);
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
    } catch (err: any) {
      this.logger.error(`Failed to send email for ${event.eventType}: ${err.message}`);
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

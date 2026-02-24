import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  SecurityIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '../entities/security-incident.entity';
import {
  BreachNotification,
  NotificationChannel,
  NotificationStatus,
} from '../entities/breach-notification.entity';

export interface CreateIncidentDto {
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  affectedSystem?: string;
  affectedPatientsCount?: number;
  affectedDataTypes?: string[];
  phiInvolved?: boolean;
  reportedBy?: string;
  relatedAuditLogIds?: string[];
}

export interface UpdateIncidentDto {
  status?: IncidentStatus;
  assignedTo?: string;
  rootCause?: string;
  remediationSteps?: string;
  affectedPatientsCount?: number;
  evidenceLinks?: string[];
}

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);

  // HIPAA Rule: Breach notifications must go out within 60 days
  private readonly BREACH_NOTIFICATION_DEADLINE_DAYS = 60;
  private readonly HHS_NOTIFICATION_THRESHOLD = 500; // patients

  constructor(
    @InjectRepository(SecurityIncident)
    private readonly incidentRepository: Repository<SecurityIncident>,
    @InjectRepository(BreachNotification)
    private readonly notificationRepository: Repository<BreachNotification>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new security incident and trigger automated response
   */
  async createIncident(dto: CreateIncidentDto): Promise<SecurityIncident> {
    const incident = this.incidentRepository.create({
      ...dto,
      status: IncidentStatus.DETECTED,
      detectedAt: new Date(),
      breachNotificationRequired: dto.phiInvolved ?? false,
      timeline: [
        {
          timestamp: new Date(),
          event: 'Incident detected and created',
          actor: dto.reportedBy || 'SYSTEM',
        },
      ],
    });

    const saved = await this.incidentRepository.save(incident);

    // Trigger automated response workflows
    this.eventEmitter.emit('incident.created', saved);

    if (dto.phiInvolved) {
      await this.initiateBreachResponse(saved);
    }

    if (dto.severity === IncidentSeverity.CRITICAL) {
      this.eventEmitter.emit('incident.critical', saved);
    }

    return saved;
  }

  /**
   * Update incident status with timeline tracking
   */
  async updateIncident(
    id: string,
    dto: UpdateIncidentDto,
    actor: string,
  ): Promise<SecurityIncident> {
    const incident = await this.incidentRepository.findOneOrFail({ where: { id } });
    const now = new Date();

    const timeline = [...(incident.timeline || [])];
    timeline.push({
      timestamp: now,
      event: `Status updated to ${dto.status || incident.status}`,
      actor,
    });

    if (dto.status === IncidentStatus.CONTAINED) {
      incident.containedAt = now;
    }
    if (dto.status === IncidentStatus.REMEDIATED) {
      incident.remediatedAt = now;
    }

    const updated = await this.incidentRepository.save({
      ...incident,
      ...dto,
      timeline,
    });

    this.eventEmitter.emit('incident.updated', updated);
    return updated;
  }

  /**
   * Initiate HIPAA breach response workflow
   */
  private async initiateBreachResponse(incident: SecurityIncident): Promise<void> {
    this.logger.warn(`Initiating breach response for incident ${incident.id}`);

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + this.BREACH_NOTIFICATION_DEADLINE_DAYS);

    // Schedule notifications based on severity
    const notifications: Partial<BreachNotification>[] = [];

    // Always notify internal security team immediately
    notifications.push({
      incidentId: incident.id,
      channel: NotificationChannel.EMAIL,
      recipient: 'security-team@hospital.org',
      status: NotificationStatus.PENDING,
      scheduledAt: new Date(),
      deadlineAt: deadline,
    });

    // Large breach (500+) requires HHS notification and media
    if ((incident.affectedPatientsCount || 0) >= this.HHS_NOTIFICATION_THRESHOLD) {
      notifications.push({
        incidentId: incident.id,
        channel: NotificationChannel.HHS_PORTAL,
        recipient: 'HHS OCR',
        status: NotificationStatus.PENDING,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        deadlineAt: deadline,
      });

      notifications.push({
        incidentId: incident.id,
        channel: NotificationChannel.MEDIA,
        recipient: 'Prominent media outlets in affected area',
        status: NotificationStatus.PENDING,
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
        deadlineAt: deadline,
      });
    }

    // Schedule patient notification
    if ((incident.affectedPatientsCount || 0) > 0) {
      notifications.push({
        incidentId: incident.id,
        channel: NotificationChannel.MAIL,
        recipient: 'Affected patients',
        status: NotificationStatus.PENDING,
        scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h
        deadlineAt: deadline,
      });
    }

    await this.notificationRepository.save(notifications);
    this.eventEmitter.emit('breach.notification.scheduled', { incident, notifications });
  }

  /**
   * Process pending breach notifications
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processNotifications(): Promise<void> {
    const pending = await this.notificationRepository.find({
      where: {
        status: NotificationStatus.PENDING,
        scheduledAt: LessThan(new Date()),
      },
      take: 20,
    });

    for (const notification of pending) {
      await this.sendNotification(notification);
    }
  }

  /**
   * Check for overdue breach notifications (HIPAA compliance monitor)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkOverdueNotifications(): Promise<void> {
    const overdue = await this.notificationRepository.find({
      where: {
        status: NotificationStatus.PENDING,
        deadlineAt: LessThan(new Date()),
      },
    });

    if (overdue.length > 0) {
      this.logger.error(`${overdue.length} breach notifications are overdue!`);
      this.eventEmitter.emit('breach.notification.overdue', { count: overdue.length, overdue });
    }
  }

  private async sendNotification(notification: BreachNotification): Promise<void> {
    try {
      // Emit to notification handler (email service, HHS API, etc.)
      this.eventEmitter.emit('notification.send', notification);

      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });

      this.logger.log(`Breach notification ${notification.id} sent via ${notification.channel}`);
    } catch (error) {
      const err = error as Error;
      await this.notificationRepository.update(notification.id, {
        retryCount: notification.retryCount + 1,
        errorMessage: err.message,
      });
      this.logger.error(`Failed to send notification ${notification.id}`, err);
    }
  }

  @OnEvent('audit.anomaly')
  async handleAuditAnomaly(payload: {
    userId: string;
    count: number;
    windowMinutes: number;
  }): Promise<void> {
    await this.createIncident({
      type: IncidentType.UNAUTHORIZED_ACCESS,
      severity: IncidentSeverity.HIGH,
      description: `Anomalous PHI access detected: user ${payload.userId} accessed ${payload.count} records in ${payload.windowMinutes} minutes`,
      affectedSystem: 'PHI Access System',
      phiInvolved: true,
      reportedBy: 'AUTOMATED_MONITORING',
    });
  }

  async findAll(status?: IncidentStatus): Promise<SecurityIncident[]> {
    return this.incidentRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<SecurityIncident> {
    return this.incidentRepository.findOneOrFail({ where: { id } });
  }

  async getBreachNotifications(incidentId: string): Promise<BreachNotification[]> {
    return this.notificationRepository.find({
      where: { incidentId },
      order: { scheduledAt: 'ASC' },
    });
  }
}

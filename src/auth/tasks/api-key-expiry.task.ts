import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuditAction } from '../../common/audit/audit-log.entity';

@Injectable()
export class ApiKeyExpiryTask {
  private readonly logger = new Logger(ApiKeyExpiryTask.name);
  private readonly THRESHOLDS: { days: 30 | 14 | 7; field: keyof ApiKey }[] = [
    { days: 30, field: 'expiryNotified30d' },
    { days: 14, field: 'expiryNotified14d' },
    { days: 7, field: 'expiryNotified7d' },
  ];

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleApiKeyExpiryNotifications(): Promise<void> {
    this.logger.log('ApiKeyExpiryTask started');

    for (const threshold of this.THRESHOLDS) {
      await this.notifyThreshold(threshold.days, threshold.field);
    }

    this.logger.log('ApiKeyExpiryTask finished');
  }

  private async notifyThreshold(days: 30 | 14 | 7, notifiedField: keyof ApiKey): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const keys = await this.apiKeyRepository.find({
      where: { isActive: true, expiresAt: Between(windowStart, windowEnd), [notifiedField]: false },
      relations: ['createdBy'],
    });

    for (const key of keys) {
      try {
        const ownerEmail = key.createdBy?.email;
        if (ownerEmail && (this.notificationsService as any).sendEmail) {
          await (this.notificationsService as any).sendEmail(
            ownerEmail,
            `API Key "${key.name}" expires in ${days} days`,
            'ApiKeyExpiringSoon',
            { keyName: key.name, daysRemaining: days, expiresAt: key.expiresAt },
          );
        }

        await this.apiKeyRepository.update(key.id, { [notifiedField]: true });

        await this.auditService.logAction(
          AuditAction.API_KEY_REVOKED,
          key.createdById,
          `Expiry notification sent for API key "${key.name}" (${days}d warning)`,
          { apiKeyId: key.id, daysRemaining: days },
          '',
          '',
        );

        this.logger.log(`Notified owner of key "${key.name}" (${days}d warning)`);
      } catch (error) {
        this.logger.error(`Failed to notify for key ${key.id}: ${error.message}`);
      }
    }
  }
}

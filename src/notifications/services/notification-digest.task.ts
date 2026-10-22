import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { NotificationOutboxEntry, OutboxStatus } from '../entities/notification-outbox.entity';
import { NotificationPreferenceCenterService } from './notification-preference-center.service';
import { NotificationsService } from './notifications.service';

const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Batches non-urgent notifications for digest subscribers into one daily summary email. */
@Injectable()
export class NotificationDigestTask {
  private readonly logger = new Logger(NotificationDigestTask.name);

  constructor(
    @InjectRepository(NotificationOutboxEntry)
    private readonly outboxRepo: Repository<NotificationOutboxEntry>,
    private readonly preferenceCenter: NotificationPreferenceCenterService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDailyDigests(): Promise<void> {
    const digestPrefs = await this.preferenceCenter.getAllDigestSubscribers();
    const userIds = [...new Set(digestPrefs.map((p) => p.userId))];

    if (userIds.length === 0) {
      return;
    }

    const since = new Date(Date.now() - DIGEST_WINDOW_MS);

    for (const userId of userIds) {
      const entries = await this.outboxRepo.find({
        where: {
          patient_id: userId,
          status: OutboxStatus.COMPLETED,
          created_at: MoreThanOrEqual(since),
        },
        order: { created_at: 'ASC' },
      });

      if (entries.length === 0) {
        continue;
      }

      await this.notificationsService.sendEmail(
        userId,
        `Your daily notification summary (${entries.length})`,
        'daily-digest',
        { items: entries.map((entry) => entry.payload) },
      );

      this.logger.log(`Sent daily digest with ${entries.length} item(s) to user ${userId}`);
    }
  }
}

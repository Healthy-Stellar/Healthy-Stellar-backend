import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';
import { NotificationsService } from '../notifications/services/notifications.service';
import { RedisLockService } from '../common/utils/redis-lock.service';

@Injectable()
export class AccessGrantCleanupTask {
  private readonly logger = new Logger(AccessGrantCleanupTask.name);
  private readonly LOCK_KEY = 'lock:access-grant-cleanup';
  private readonly LOCK_TTL_MS = 60_000;

  constructor(
    @InjectRepository(AccessGrant)
    private readonly accessGrantRepo: Repository<AccessGrant>,
    private readonly notificationsService: NotificationsService,
    private readonly redisLock: RedisLockService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredGrants(): Promise<void> {
    const startTime = Date.now();
    this.logger.log('AccessGrantCleanupTask started');

    const acquired = await this.redisLock.acquireLock(this.LOCK_KEY, this.LOCK_TTL_MS);
    if (!acquired) {
      this.logger.warn('Could not acquire distributed lock; skipping cleanup');
      return;
    }

    let processed = 0;
    const errors: string[] = [];

    try {
      const expiredGrants = await this.accessGrantRepo.find({
        where: {
          expiresAt: LessThan(new Date()),
          status: GrantStatus.ACTIVE,
        },
      });

      for (const grant of expiredGrants) {
        try {
          grant.status = GrantStatus.EXPIRED;
          await this.accessGrantRepo.save(grant);

          this.notificationsService.emitAccessRevoked(grant.patientId, grant.id, {
            granteeId: grant.granteeId,
            reason: 'Grant expired',
          });

          processed++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Grant ${grant.id}: ${message}`);
        }
      }
    } finally {
      await this.redisLock.releaseLock(this.LOCK_KEY);
      const duration = Date.now() - startTime;
      this.logger.log(
        `AccessGrantCleanupTask finished — processed: ${processed}, duration: ${duration}ms, errors: ${errors.length}`,
      );
      if (errors.length > 0) {
        this.logger.error(`Errors: ${errors.join(', ')}`);
      }
    }
  }
}

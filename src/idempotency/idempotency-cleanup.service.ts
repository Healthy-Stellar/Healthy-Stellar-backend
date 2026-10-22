import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { HttpIdempotencyEntity } from './idempotency.entity';

@Injectable()
export class IdempotencyCleanupService {
  private readonly logger = new Logger(IdempotencyCleanupService.name);
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 h — mirrors interceptor TTL

  constructor(
    @InjectRepository(HttpIdempotencyEntity)
    private readonly idempotencyRepo: Repository<HttpIdempotencyEntity>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredKeys(): Promise<void> {
    const cutoff = new Date(Date.now() - this.TTL_MS);
    const startMs = Date.now();

    try {
      const result = await this.idempotencyRepo.delete({
        createdAt: LessThan(cutoff),
      });

      const deleted = result.affected ?? 0;
      const elapsedMs = Date.now() - startMs;

      if (deleted > 0) {
        this.logger.log(
          `Idempotency cleanup: deleted ${deleted} expired key(s) ` +
            `(cutoff=${cutoff.toISOString()}, elapsed=${elapsedMs}ms)`,
        );
      } else {
        this.logger.debug(
          `Idempotency cleanup: no expired keys found (cutoff=${cutoff.toISOString()})`,
        );
      }
    } catch (err) {
      // Log and swallow — cleanup failure must not crash the application
      this.logger.error(
        `Idempotency cleanup failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  async runManualCleanup(ttlMs = this.TTL_MS): Promise<number> {
    const cutoff = new Date(Date.now() - ttlMs);
    const result = await this.idempotencyRepo.delete({ createdAt: LessThan(cutoff) });
    return result.affected ?? 0;
  }
}

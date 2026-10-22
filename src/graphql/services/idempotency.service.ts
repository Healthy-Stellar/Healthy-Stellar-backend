import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { IdempotencyEntity } from '../entities/idempotency.entity';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly TTL_HOURS = 24;

  constructor(
    @InjectRepository(IdempotencyEntity)
    private readonly repo: Repository<IdempotencyEntity>,
  ) {}

  async get(key: string): Promise<Record<string, any> | null> {
    const cutoff = new Date(Date.now() - this.TTL_HOURS * 60 * 60 * 1000);
    const record = await this.repo.findOne({
      where: { key, createdAt: MoreThan(cutoff) },
    });
    return record?.payload ?? null;
  }

  async set(key: string, payload: Record<string, any>): Promise<void> {
    await this.repo.upsert({ key, payload }, ['key']);
    this.logger.debug(`Idempotency key stored: ${key}`);
  }
}

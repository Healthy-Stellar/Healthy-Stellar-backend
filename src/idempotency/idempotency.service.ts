import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { IdempotencyKey } from './idempotency-key.entity';

@Injectable()
export class IdempotencyService {
  private readonly defaultTtlMs: number;

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
    private readonly config: ConfigService,
  ) {
    this.defaultTtlMs = this.config.get<number>('IDEMPOTENCY_TTL_MS', 86_400_000); // 24 h
  }

  async find(key: string): Promise<IdempotencyKey | null> {
    const record = await this.repo.findOne({ where: { key } });
    if (!record) return null;
    if (record.expiresAt <= new Date()) {
      await this.repo.delete({ key });
      return null;
    }
    return record;
  }

  async store(
    key: string,
    statusCode: number,
    responseBody: string,
    ttlMs?: number,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + (ttlMs ?? this.defaultTtlMs));
    await this.repo.upsert({ key, statusCode, responseBody, expiresAt }, ['key']);
  }

  async deleteExpired(): Promise<number> {
    const result = await this.repo.delete({ expiresAt: LessThan(new Date()) });
    return result.affected ?? 0;
  }
}

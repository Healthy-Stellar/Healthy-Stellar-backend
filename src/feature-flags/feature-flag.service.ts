import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag, RolloutStrategy } from './feature-flag.entity';

export interface UpsertFeatureFlagDto {
  key: string;
  enabled: boolean;
  strategy?: RolloutStrategy;
  rolloutPercentage?: number;
  allowlist?: string[];
  description?: string;
}

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    @InjectRepository(FeatureFlag)
    private readonly repo: Repository<FeatureFlag>,
  ) {}

  async isEnabled(key: string, actorId?: string): Promise<boolean> {
    const flag = await this.repo.findOne({ where: { key } });
    if (!flag || !flag.enabled) return false;

    switch (flag.strategy) {
      case RolloutStrategy.PERCENTAGE: {
        if (!actorId) return false;
        // Deterministic hash so the same actor always gets the same result
        const hash = this.stableHash(actorId + key);
        return (hash % 100) < flag.rolloutPercentage;
      }
      case RolloutStrategy.ALLOWLIST: {
        if (!actorId || !flag.allowlist || flag.allowlist.length === 0) return false;
        return flag.allowlist.includes(actorId);
      }
      default:
        return true;
    }
  }

  async upsert(dto: UpsertFeatureFlagDto, actorId: string): Promise<FeatureFlag> {
    let flag = await this.repo.findOne({ where: { key: dto.key } });
    const wasEnabled = flag?.enabled;

    if (!flag) {
      flag = this.repo.create({ key: dto.key });
    }

    Object.assign(flag, {
      enabled: dto.enabled,
      strategy: dto.strategy ?? flag.strategy,
      rolloutPercentage: dto.rolloutPercentage ?? flag.rolloutPercentage,
      allowlist: dto.allowlist ?? flag.allowlist,
      description: dto.description ?? flag.description,
      updatedBy: actorId,
    });

    const saved = await this.repo.save(flag);
    this.logger.log(
      `Feature flag [${dto.key}] ${wasEnabled ? 'was' : 'was not'} enabled → now ${dto.enabled} by ${actorId}`,
    );
    return saved;
  }

  async rollback(key: string, actorId: string): Promise<FeatureFlag> {
    const flag = await this.repo.findOne({ where: { key } });
    if (!flag) throw new NotFoundException(`Feature flag '${key}' not found`);
    flag.enabled = false;
    flag.updatedBy = actorId;
    const saved = await this.repo.save(flag);
    this.logger.warn(`Feature flag [${key}] ROLLED BACK (disabled) by ${actorId}`);
    return saved;
  }

  async findAll(): Promise<FeatureFlag[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  /** Stable numeric hash of a string (djb2) */
  private stableHash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return Math.abs(hash);
  }
}

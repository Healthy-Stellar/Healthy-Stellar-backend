import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag, RolloutStrategy } from './feature-flag.entity';

export interface EvaluationContext {
  /** User / actor ID for PERCENTAGE and ALLOWLIST strategies */
  actorId?: string;
  /** Tenant ID for TENANT_ALLOWLIST and TENANT_PERCENTAGE strategies */
  tenantId?: string;
}

export interface UpsertFeatureFlagDto {
  key: string;
  enabled: boolean;
  strategy?: RolloutStrategy;
  rolloutPercentage?: number;
  tenantRolloutPercentage?: number;
  allowlist?: string[];
  tenantAllowlist?: string[];
  description?: string;
}

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    @InjectRepository(FeatureFlag)
    private readonly repo: Repository<FeatureFlag>,
  ) {}

  /**
   * Evaluate whether a feature flag is enabled for the given context.
   *
   * Accepts either a legacy string actorId (backward-compat) or a full
   * EvaluationContext with actorId + tenantId.
   */
  async isEnabled(
    key: string,
    contextOrActorId?: string | EvaluationContext,
  ): Promise<boolean> {
    const ctx = this.normalizeContext(contextOrActorId);
    const flag = await this.repo.findOne({ where: { key } });
    if (!flag || !flag.enabled) return false;

    return this.evaluate(flag, ctx);
  }

  /** Batch-evaluate multiple flags in a single DB round-trip. */
  async evaluateMany(
    keys: string[],
    context?: EvaluationContext,
  ): Promise<Record<string, boolean>> {
    if (keys.length === 0) return {};
    const ctx = context ?? {};
    const flags = await this.repo
      .createQueryBuilder('f')
      .where('f.key IN (:...keys)', { keys })
      .getMany();

    const result: Record<string, boolean> = {};
    for (const key of keys) {
      result[key] = false;
    }
    for (const flag of flags) {
      result[flag.key] = flag.enabled ? this.evaluate(flag, ctx) : false;
    }
    return result;
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
      tenantRolloutPercentage: dto.tenantRolloutPercentage ?? flag.tenantRolloutPercentage,
      allowlist: dto.allowlist ?? flag.allowlist,
      tenantAllowlist: dto.tenantAllowlist ?? flag.tenantAllowlist,
      description: dto.description ?? flag.description,
      updatedBy: actorId,
    });

    const saved = await this.repo.save(flag);
    this.logger.log(
      `Feature flag [${dto.key}] ${wasEnabled ? 'was' : 'was not'} enabled → now ${dto.enabled} (strategy: ${saved.strategy}) by ${actorId}`,
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

  private evaluate(flag: FeatureFlag, ctx: EvaluationContext): boolean {
    switch (flag.strategy) {
      case RolloutStrategy.PERCENTAGE: {
        if (!ctx.actorId) return false;
        const hash = this.stableHash(ctx.actorId + flag.key);
        return hash % 100 < flag.rolloutPercentage;
      }

      case RolloutStrategy.ALLOWLIST: {
        if (!ctx.actorId || !flag.allowlist?.length) return false;
        return flag.allowlist.includes(ctx.actorId);
      }

      case RolloutStrategy.TENANT_ALLOWLIST: {
        if (!ctx.tenantId || !flag.tenantAllowlist?.length) return false;
        return flag.tenantAllowlist.includes(ctx.tenantId);
      }

      case RolloutStrategy.TENANT_PERCENTAGE: {
        if (!ctx.tenantId) return false;
        // Within an allowed tenant, further gate per-actor if actorId is present
        const tenantHash = this.stableHash(ctx.tenantId + flag.key);
        const tenantIn = tenantHash % 100 < flag.tenantRolloutPercentage;
        if (!tenantIn) return false;
        // Optional: also gate by actor percentage when both are configured
        if (ctx.actorId && flag.rolloutPercentage > 0) {
          const actorHash = this.stableHash(ctx.actorId + flag.key);
          return actorHash % 100 < flag.rolloutPercentage;
        }
        return true;
      }

      default:
        return true;
    }
  }

  private normalizeContext(
    input?: string | EvaluationContext,
  ): EvaluationContext {
    if (!input) return {};
    if (typeof input === 'string') return { actorId: input };
    return input;
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

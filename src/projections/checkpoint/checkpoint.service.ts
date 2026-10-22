import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectionCheckpoint } from './projection-checkpoint.entity';

@Injectable()
export class CheckpointService {
  constructor(
    @InjectRepository(ProjectionCheckpoint)
    private readonly repo: Repository<ProjectionCheckpoint>,
  ) {}

  async getVersion(projectorName: string, aggregateId: string): Promise<number> {
    const row = await this.repo.findOne({ where: { projectorName, aggregateId } });
    return row?.lastProcessedVersion ?? 0;
  }

  async advance(projectorName: string, aggregateId: string, version: number): Promise<void> {
    await this.repo.query(
      `INSERT INTO "projection_checkpoints"
         ("projector_name", "aggregate_id", "last_processed_version", "event_count", "updated_at")
       VALUES ($1, $2, $3, 1, NOW())
       ON CONFLICT ("projector_name", "aggregate_id")
       DO UPDATE SET
         "last_processed_version" = EXCLUDED."last_processed_version",
         "event_count" = "projection_checkpoints"."event_count" + 1,
         "updated_at" = EXCLUDED."updated_at"`,
      [projectorName, aggregateId, version],
    );
  }

  /** Resets every per-aggregate checkpoint tracked for a projector (e.g. before a full replay). */
  async reset(projectorName: string): Promise<void> {
    await this.repo.delete({ projectorName });
  }

  /**
   * Highest per-aggregate version recorded for a projector, for coarse admin
   * status reporting only. This is NOT a substitute for the per-aggregate
   * check in `getVersion` — a single number can't represent per-aggregate
   * progress.
   */
  async getMaxVersion(projectorName: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('checkpoint')
      .select('MAX(checkpoint.lastProcessedVersion)', 'max')
      .where('checkpoint.projectorName = :projectorName', { projectorName })
      .getRawOne<{ max: string | null }>();
    return result?.max ? Number(result.max) : 0;
  }
}
